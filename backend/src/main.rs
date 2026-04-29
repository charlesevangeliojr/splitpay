use std::{
    collections::HashMap,
    net::SocketAddr,
    str::FromStr,
    sync::{Arc, RwLock},
    process::Command,
};

use axum::{
    extract::{Path, State},
    http::{HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use soroban_sdk::{
    xdr::{
        self, AccountId, InvokeContractArgs, Memo, Operation, OperationBody,
        PublicKey, ScAddress, ScSymbol, ScVal, ScVec, SequenceNumber, Transaction,
        TransactionExt, Uint256, VecM, Hash as XdrHash, Limits, ReadXdr, WriteXdr,
        ScBytes, TransactionEnvelope, TransactionV1Envelope, DecoratedSignature,
        Signature, OperationResult, TransactionResultResult, Hash, ScString, ScMap, ScMapEntry,
    },
    Address as SdkAddress, Symbol,
};
use stellar_rpc_client::Client;

#[derive(Clone)]
struct AppState {
    db: Arc<RwLock<Database>>,
    contract: ContractConfig,
}

#[derive(Default)]
struct Database {
    sessions: HashMap<String, Session>,
    splits: HashMap<String, Split>,
    activities: Vec<ActivityEvent>,
    settings: HashMap<String, UserSettings>,
}

#[derive(Clone)]
struct ContractConfig {
    contract_id: Option<String>,
    rpc_url: String,
    network_passphrase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Session {
    wallet_address: String,
    connected_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Split {
    id: String,
    label: String,
    creator: String,
    total_xlm: f64,
    per_person_xlm: f64,
    status: SplitStatus,
    participants: Vec<Participant>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Participant {
    address: String,
    amount_owed_xlm: f64,
    paid: bool,
    paid_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
enum SplitStatus {
    Unpaid,
    Settled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActivityEvent {
    id: String,
    event_type: ActivityType,
    event: String,
    split: String,
    amount_xlm: f64,
    participants: Option<u32>,
    status: Option<ActivityStatus>,
    date: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ActivityType {
    Created,
    Paid,
    Settled,
    Received,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
enum ActivityStatus {
    Unpaid,
    Paid,
    Settled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserSettings {
    active_network: String,
    currency: String,
    date_format: String,
    notify_payment_received: bool,
    notify_split_settled: bool,
    notify_payment_reminder: bool,
}

#[derive(Debug, Deserialize)]
struct ConnectWalletRequest {
    wallet_address: String,
}

#[derive(Debug, Deserialize)]
struct CreateSplitRequest {
    label: String,
    creator: String,
    total_xlm: f64,
    participants: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct PayShareRequest {
    payer: String,
}

#[derive(Debug, Deserialize)]
struct BuildTransactionRequest {
    creator: String,
    total_xlm: f64,
    participants: Vec<String>,
}

#[derive(Debug, Serialize)]
struct TransactionXdrResponse {
    xdr: String,
    split_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct SubmitTransactionRequest {
    xdr: String,
    label: Option<String>,
    creator: Option<String>,
    total_xlm: Option<f64>,
    participants: Option<Vec<String>>,
    payer: Option<String>,
    split_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ActivityQuery {
    filter: Option<String>,
}

#[derive(Debug, Serialize)]
struct ApiError {
    message: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let db = Database::default();

    let contract = ContractConfig {
        contract_id: std::env::var("SPLITPAY_CONTRACT_ID").ok(),
        rpc_url: std::env::var("SPLITPAY_RPC_URL")
            .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".to_string()),
        network_passphrase: std::env::var("SPLITPAY_NETWORK_PASSPHRASE").unwrap_or_else(|_| {
            "Test SDF Network ; September 2015".to_string()
        }),
    };
    if contract.contract_id.is_none() {
        eprintln!("Warning: SPLITPAY_CONTRACT_ID not set. Contract-backed endpoints will fail.");
    }

    let state = AppState {
        db: Arc::new(RwLock::new(db)),
        contract,
    };

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/session/connect", post(connect_wallet))
        .route("/api/session/{wallet}/disconnect", post(disconnect_wallet))
        .route("/api/session/{wallet}", get(get_session))
        .route("/api/splits", get(list_splits).post(create_split))
        .route("/api/splits/build", post(build_create_split_tx))
        .route("/api/splits/submit", post(submit_create_split_tx))
        .route("/api/splits/{id}", get(get_split))
        .route("/api/splits/{id}/pay", post(pay_share))
        .route("/api/splits/{id}/pay/build", post(build_pay_share_tx))
        .route("/api/splits/{id}/pay/submit", post(submit_pay_share_tx))
        .route("/api/activity", get(list_activity))
        .route("/api/settings/{wallet}", get(get_settings).patch(update_settings))
        .with_state(state)
        .layer(cors);

    let port = std::env::var("SPLITPAY_BACKEND_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!(
                "Failed to bind {addr}. Another process may already be using this port. \
Set SPLITPAY_BACKEND_PORT to run on a different port. Error: {err}"
            );
            return;
        }
    };

    println!("SplitPay backend running at http://{addr}");
    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("Server error: {err}");
    }
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "ok": true }))
}

async fn connect_wallet(
    State(state): State<AppState>,
    Json(payload): Json<ConnectWalletRequest>,
) -> impl IntoResponse {
    let mut db = state.db.write().unwrap();
    let session = Session {
        wallet_address: payload.wallet_address.clone(),
        connected_at: Utc::now(),
    };
    db.sessions
        .insert(payload.wallet_address.clone(), session.clone());
    db.settings
        .entry(payload.wallet_address.clone())
        .or_insert(UserSettings {
            active_network: "Testnet".to_string(),
            currency: "XLM".to_string(),
            date_format: "MM/DD/YYYY".to_string(),
            notify_payment_received: true,
            notify_split_settled: true,
            notify_payment_reminder: false,
        });
    (StatusCode::OK, Json(session))
}

async fn disconnect_wallet(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> impl IntoResponse {
    let mut db = state.db.write().unwrap();
    db.sessions.remove(&wallet);
    (StatusCode::OK, Json(serde_json::json!({ "disconnected": true })))
}

async fn get_session(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> Result<Json<Session>, (StatusCode, Json<ApiError>)> {
    let db = state.db.read().unwrap();
    db.sessions
        .get(&wallet)
        .cloned()
        .map(Json)
        .ok_or_else(not_found("Session not found"))
}

async fn create_split(
    State(state): State<AppState>,
    Json(payload): Json<CreateSplitRequest>,
) -> Result<(StatusCode, Json<Split>), (StatusCode, Json<ApiError>)> {
    if payload.participants.is_empty() || payload.total_xlm <= 0.0 {
        return Err(bad_request("Invalid split payload"));
    }

    let per_person = payload.total_xlm / payload.participants.len() as f64;
    if per_person < 1.0 {
        return Err(bad_request("Minimum 1 XLM per participant"));
    }

    let raw_id = invoke_create_split_on_contract(
        &state.contract,
        &payload.creator,
        payload.total_xlm,
        &payload.participants,
    )
    .await
    .map_err(bad_request_owned)?;
    let id = format!("#{raw_id}");
    let split = Split {
        id: id.clone(),
        label: payload.label,
        creator: payload.creator.clone(),
        total_xlm: payload.total_xlm,
        per_person_xlm: per_person,
        status: SplitStatus::Unpaid,
        participants: payload
            .participants
            .into_iter()
            .map(|address| Participant {
                address,
                amount_owed_xlm: per_person,
                paid: false,
                paid_at: None,
            })
            .collect(),
        created_at: Utc::now(),
    };

    let mut db = state.db.write().unwrap();
    db.splits.insert(id.clone(), split.clone());
    db.activities.push(ActivityEvent {
        id: Uuid::new_v4().to_string(),
        event_type: ActivityType::Created,
        event: format!("You created Split {id}"),
        split: split.label.clone(),
        amount_xlm: split.total_xlm,
        participants: Some(split.participants.len() as u32),
        status: Some(ActivityStatus::Unpaid),
        date: Utc::now(),
    });

    Ok((StatusCode::CREATED, Json(split)))
}

async fn build_create_split_tx(
    State(state): State<AppState>,
    Json(payload): Json<BuildTransactionRequest>,
) -> Result<Json<TransactionXdrResponse>, (StatusCode, Json<ApiError>)> {
    if payload.participants.is_empty() || payload.total_xlm <= 0.0 {
        return Err(bad_request("Invalid split payload"));
    }

    let per_person = payload.total_xlm / payload.participants.len() as f64;
    if per_person < 1.0 {
        return Err(bad_request("Minimum 1 XLM per participant"));
    }

    let contract_id = state
        .contract
        .contract_id
        .clone()
        .ok_or_else(|| bad_request_owned("SPLITPAY_CONTRACT_ID not configured".to_string()))?;

    let xdr = build_create_split_transaction(
        &state.contract,
        &contract_id,
        &payload.creator,
        payload.total_xlm,
        &payload.participants,
    )
    .await
    .map_err(bad_request_owned)?;

    Ok(Json(TransactionXdrResponse { xdr, split_id: None }))
}

async fn submit_create_split_tx(
    State(state): State<AppState>,
    Json(payload): Json<SubmitTransactionRequest>,
) -> Result<(StatusCode, Json<Split>), (StatusCode, Json<ApiError>)> {
    let split_id = if let Some(sid) = payload.split_id {
        sid
    } else {
        let result = submit_transaction(&state.contract, &payload.xdr)
            .await
            .map_err(bad_request_owned)?;

        extract_split_id_from_result(&result)
            .ok_or_else(|| bad_request_owned("Failed to extract split ID from transaction result".to_string()))?
    };

    let id = format!("#{split_id}");
    let total_xlm = payload.total_xlm.unwrap_or(0.0);
    let participants_count = payload.participants.as_ref().map(|p| p.len()).unwrap_or(1);
    let per_person = if participants_count > 0 { total_xlm / participants_count as f64 } else { 0.0 };

    let split = Split {
        id: id.clone(),
        label: payload.label.unwrap_or_else(|| "Created via wallet".to_string()),
        creator: payload.creator.unwrap_or_else(|| "wallet".to_string()),
        total_xlm,
        per_person_xlm: per_person,
        status: SplitStatus::Unpaid,
        participants: payload.participants.unwrap_or_default()
            .into_iter()
            .map(|address| Participant {
                address,
                amount_owed_xlm: per_person,
                paid: false,
                paid_at: None,
            })
            .collect(),
        created_at: Utc::now(),
    };

    let mut db = state.db.write().unwrap();
    db.splits.insert(id.clone(), split.clone());

    Ok((StatusCode::CREATED, Json(split)))
}

async fn build_pay_share_tx(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PayShareRequest>,
) -> Result<Json<TransactionXdrResponse>, (StatusCode, Json<ApiError>)> {
    let numeric_id = normalize_split_id(&id)?;

    let contract_id = state
        .contract
        .contract_id
        .clone()
        .ok_or_else(|| bad_request_owned("SPLITPAY_CONTRACT_ID not configured".to_string()))?;

    let xdr = build_pay_share_transaction(
        &state.contract,
        &contract_id,
        numeric_id,
        &payload.payer,
    )
    .await
    .map_err(bad_request_owned)?;

    Ok(Json(TransactionXdrResponse { xdr, split_id: Some(numeric_id) }))
}

async fn submit_pay_share_tx(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<SubmitTransactionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let numeric_id = normalize_split_id(&id)?;

    // If frontend passed split_id, it means it already submitted the transaction
    if payload.split_id.is_none() {
        let _result = submit_transaction(&state.contract, &payload.xdr)
            .await
            .map_err(bad_request_owned)?;
    }

    // Update local database
    if let Some(payer) = payload.payer {
        let mut db = state.db.write().unwrap();
        let split_key = format!("#{numeric_id}");
        if let Some(split) = db.splits.get_mut(&split_key) {
            if let Some(participant) = split.participants.iter_mut().find(|p| p.address == payer) {
                participant.paid = true;
                participant.paid_at = Some(Utc::now());
                
                if split.participants.iter().all(|p| p.paid) {
                    split.status = SplitStatus::Settled;
                }
            }
        }
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn list_splits(State(state): State<AppState>) -> impl IntoResponse {
    let split_keys: Vec<String> = {
        let db = state.db.read().unwrap();
        db.splits.keys().cloned().collect()
    };

    let mut refreshed: Vec<Split> = Vec::new();
    for key in split_keys {
        let numeric_id = match normalize_split_id(&key) {
            Ok(id) => id,
            Err(_) => continue,
        };

        // Ensure split exists on-chain; if not, keep cached value as fallback.
        let _ = invoke_get_split_on_contract(&state.contract, numeric_id).await;
        let settled = invoke_is_settled_on_contract(&state.contract, numeric_id).await.ok();

        let maybe_split = {
            let db = state.db.read().unwrap();
            db.splits.get(&key).cloned()
        };

        let Some(mut split) = maybe_split else {
            continue;
        };

        for participant in &mut split.participants {
            if let Ok(paid) =
                invoke_get_payment_status_on_contract(&state.contract, numeric_id, &participant.address).await
            {
                participant.paid = paid;
                if !paid {
                    participant.paid_at = None;
                }
            }
        }

        if let Some(is_settled) = settled {
            split.status = if is_settled {
                SplitStatus::Settled
            } else {
                SplitStatus::Unpaid
            };
        }

        {
            let mut db = state.db.write().unwrap();
            db.splits.insert(key.clone(), split.clone());
        }
        refreshed.push(split);
    }

    let mut values = refreshed;
    values.sort_by_key(|s| s.created_at);
    Json(values)
}

async fn get_split(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Split>, (StatusCode, Json<ApiError>)> {
    let numeric_id = normalize_split_id(&id)?;
    let split_key = format!("#{numeric_id}");

    // Verify split exists on-chain first.
    invoke_get_split_on_contract(&state.contract, numeric_id).await.map_err(bad_request_owned)?;
    let settled_on_chain = invoke_is_settled_on_contract(&state.contract, numeric_id).await.map_err(bad_request_owned)?;

    let mut split = {
        let db = state.db.read().unwrap();
        db.splits
            .get(&split_key)
            .cloned()
            .ok_or_else(not_found("Split not found in backend cache"))?
    };

    for participant in &mut split.participants {
        let paid = invoke_get_payment_status_on_contract(&state.contract, numeric_id, &participant.address).await
            .map_err(bad_request_owned)?;
        participant.paid = paid;
        if !paid {
            participant.paid_at = None;
        }
    }

    split.status = if settled_on_chain {
        SplitStatus::Settled
    } else {
        SplitStatus::Unpaid
    };

    {
        let mut db = state.db.write().unwrap();
        db.splits.insert(split_key, split.clone());
    }

    Ok(Json(split))
}

async fn pay_share(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PayShareRequest>,
) -> Result<Json<Split>, (StatusCode, Json<ApiError>)> {
    let numeric_id = normalize_split_id(&id)?;
    invoke_pay_share_on_contract(&state.contract, numeric_id, &payload.payer).await.map_err(bad_request_owned)?;

    let mut db = state.db.write().unwrap();
    let (split_snapshot, paid_amount) = {
        let split_key = format!("#{numeric_id}");
        let split = db
            .splits
            .get_mut(&split_key)
            .ok_or_else(not_found("Split not found"))?;

        let participant = split
            .participants
            .iter_mut()
            .find(|p| p.address == payload.payer)
            .ok_or_else(not_found("Participant not found"))?;

        participant.paid = true;
        participant.paid_at = Some(Utc::now());
        let paid_amount = participant.amount_owed_xlm;

        if split.participants.iter().all(|p| p.paid) {
            split.status = SplitStatus::Settled;
        }

        (split.clone(), paid_amount)
    };

    db.activities.push(ActivityEvent {
        id: Uuid::new_v4().to_string(),
        event_type: ActivityType::Paid,
        event: format!("{} paid {}", truncate(&payload.payer), split_snapshot.id),
        split: split_snapshot.label.clone(),
        amount_xlm: paid_amount,
        participants: None,
        status: Some(ActivityStatus::Paid),
        date: Utc::now(),
    });

    Ok(Json(split_snapshot))
}

async fn list_activity(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<ActivityQuery>,
) -> impl IntoResponse {
    let db = state.db.read().unwrap();
    let mut list = db.activities.clone();
    if let Some(filter) = query.filter {
        list.retain(|a| match filter.to_lowercase().as_str() {
            "created" => matches!(a.event_type, ActivityType::Created),
            "paid" => matches!(a.event_type, ActivityType::Paid),
            "settled" => matches!(a.event_type, ActivityType::Settled),
            "received" => matches!(a.event_type, ActivityType::Received),
            _ => true,
        });
    }
    Json(list)
}

async fn get_settings(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
) -> impl IntoResponse {
    let db = state.db.read().unwrap();
    let settings = db.settings.get(&wallet).cloned().unwrap_or(UserSettings {
        active_network: "Testnet".to_string(),
        currency: "XLM".to_string(),
        date_format: "MM/DD/YYYY".to_string(),
        notify_payment_received: true,
        notify_split_settled: true,
        notify_payment_reminder: false,
    });
    Json(settings)
}

async fn update_settings(
    State(state): State<AppState>,
    Path(wallet): Path<String>,
    Json(payload): Json<UserSettings>,
) -> impl IntoResponse {
    let mut db = state.db.write().unwrap();
    db.settings.insert(wallet, payload.clone());
    Json(payload)
}

fn truncate(address: &str) -> String {
    if address.len() < 8 {
        return address.to_string();
    }
    format!("{}...{}", &address[..4], &address[address.len() - 4..])
}

fn normalize_split_id(id: &str) -> Result<u64, (StatusCode, Json<ApiError>)> {
    let raw = id.trim_start_matches('#');
    raw.parse::<u64>()
        .map_err(|_| bad_request("Split id must be numeric"))
}

fn stellar_native_contract_address() -> &'static str {
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
}

fn parse_contract_address(addr: &str) -> Result<ScAddress, String> {
    if addr.len() == 56 && addr.starts_with('G') {
        let pk = parse_public_key(addr)?;
        Ok(ScAddress::Account(AccountId(pk)))
    } else if addr.len() == 56 && addr.starts_with('C') {
        let hash = parse_contract_hash(addr)?;
        Ok(ScAddress::Contract(XdrHash(hash)))
    } else {
        Err(format!("Invalid address format: {}", addr))
    }
}

fn parse_public_key(addr: &str) -> Result<PublicKey, String> {
    let decoded = stellar_strkey::Strkey::PublicKeyEd25519(
        stellar_strkey::ed25519::PublicKey::from_string(addr)
            .map_err(|e| format!("Invalid public key: {}", e))?
    );

    match decoded {
        stellar_strkey::Strkey::PublicKeyEd25519(pk) => {
            let mut bytes = [0u8; 32];
            bytes.copy_from_slice(&pk.0);
            Ok(PublicKey::PublicKeyTypeEd25519(Uint256(bytes)))
        }
        _ => Err("Invalid public key type".to_string()),
    }
}

fn parse_contract_hash(addr: &str) -> Result<[u8; 32], String> {
    let decoded = stellar_strkey::Contract::from_string(addr)
        .map_err(|e| format!("Invalid contract address: {}", e))?;
    Ok(decoded.0)
}

fn sc_val_from_i128(value: i128) -> ScVal {
    let bytes = value.to_be_bytes();
    let hi = i64::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]]);
    let lo = u64::from_be_bytes([bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]);
    ScVal::I128(xdr::Int128Parts { hi, lo })
}

fn sc_val_from_address(addr: &str) -> Result<ScVal, String> {
    let sc_addr = parse_contract_address(addr)?;
    Ok(ScVal::Address(sc_addr))
}

async fn build_create_split_transaction(
    contract: &ContractConfig,
    contract_id: &str,
    creator: &str,
    total_xlm: f64,
    participants: &[String],
) -> Result<String, String> {
    let rpc_url = &contract.rpc_url;
    let client = Client::new(rpc_url).map_err(|e| format!("Failed to create RPC client: {}", e))?;

    let total_amount_stroops = (total_xlm * 10_000_000.0).round() as i128;

    let contract_sc_addr = parse_contract_address(contract_id)?;
    let contract_address = ScAddress::Contract(
        match contract_sc_addr {
            ScAddress::Contract(id) => id,
            _ => return Err("Invalid contract address".to_string()),
        }
    );

    let creator_pk = parse_public_key(creator)?;
    let source_account = AccountId(creator_pk.clone());

    // Fetch current sequence number from RPC
    let account_info = client.get_account(creator).await
        .map_err(|e| format!("Failed to fetch account info: {}", e))?;
    let next_seq = account_info.seq_num.0 + 1;

    let mut args_vec = vec![
        sc_val_from_address(creator)?,
        sc_val_from_i128(total_amount_stroops),
    ];

    let mut participants_vec_raw = vec![];
    for p in participants {
        participants_vec_raw.push(sc_val_from_address(p)?);
    }
    let participants_vec = VecM::try_from(participants_vec_raw).map_err(|e| format!("Participants too large: {:?}", e))?;
    args_vec.push(ScVal::Vec(Some(ScVec(participants_vec))));
    args_vec.push(sc_val_from_address(stellar_native_contract_address())?);
    let args = VecM::try_from(args_vec).map_err(|e| format!("Args too large: {:?}", e))?;

    let invoke_args = InvokeContractArgs {
        contract_address,
        function_name: ScSymbol("create_split".to_string().try_into().unwrap()),
        args,
    };

    let operation = Operation {
        source_account: None,
        body: OperationBody::InvokeHostFunction(xdr::InvokeHostFunctionOp {
            host_function: xdr::HostFunction::InvokeContract(invoke_args),
            auth: VecM::default(),
        }),
    };

    let tx = Transaction {
        source_account: xdr::MuxedAccount::from(source_account),
        fee: 10000,
        seq_num: SequenceNumber(next_seq),
        cond: xdr::Preconditions::None,
        memo: Memo::None,
        operations: VecM::try_from(vec![operation]).map_err(|e| format!("Failed to create operations: {}", e))?,
        ext: TransactionExt::V0,
    };

    let tx_envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
        tx,
        signatures: VecM::default(),
    });

    let xdr_bytes = tx_envelope.to_xdr(Limits::none()).map_err(|e| format!("Failed to serialize: {}", e))?;
    let xdr_base64 = base64::encode(&xdr_bytes);

    Ok(xdr_base64)
}

async fn build_pay_share_transaction(
    contract: &ContractConfig,
    contract_id: &str,
    split_id: u64,
    payer: &str,
) -> Result<String, String> {
    let rpc_url = &contract.rpc_url;
    let client = Client::new(rpc_url).map_err(|e| format!("Failed to create RPC client: {}", e))?;

    let contract_sc_addr = parse_contract_address(contract_id)?;
    let contract_address = ScAddress::Contract(
        match contract_sc_addr {
            ScAddress::Contract(id) => id,
            _ => return Err("Invalid contract address".to_string()),
        }
    );

    let payer_pk = parse_public_key(payer)?;
    let source_account = AccountId(payer_pk);

    // Fetch current sequence number from RPC
    let account_info = client.get_account(payer).await
        .map_err(|e| format!("Failed to fetch account info: {}", e))?;
    let next_seq = account_info.seq_num.0 + 1;

    let args_vec = vec![
        ScVal::U64(split_id),
        sc_val_from_address(payer)?,
    ];
    let args = VecM::try_from(args_vec).map_err(|e| format!("Args too large: {:?}", e))?;

    let invoke_args = InvokeContractArgs {
        contract_address,
        function_name: ScSymbol("pay_share".to_string().try_into().unwrap()),
        args,
    };

    let operation = Operation {
        source_account: None,
        body: OperationBody::InvokeHostFunction(xdr::InvokeHostFunctionOp {
            host_function: xdr::HostFunction::InvokeContract(invoke_args),
            auth: VecM::default(),
        }),
    };

    let tx = Transaction {
        source_account: xdr::MuxedAccount::from(source_account),
        fee: 10000,
        seq_num: SequenceNumber(next_seq),
        cond: xdr::Preconditions::None,
        memo: Memo::None,
        operations: VecM::try_from(vec![operation]).map_err(|e| format!("Failed to create operations: {}", e))?,
        ext: TransactionExt::V0,
    };

    let tx_envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
        tx,
        signatures: VecM::default(),
    });

    let xdr_bytes = tx_envelope.to_xdr(Limits::none()).map_err(|e| format!("Failed to serialize: {}", e))?;
    let xdr_base64 = base64::encode(&xdr_bytes);

    Ok(xdr_base64)
}

async fn submit_transaction(
    contract: &ContractConfig,
    signed_xdr: &str,
) -> Result<serde_json::Value, String> {
    let rpc_url = &contract.rpc_url;
    let client = Client::new(rpc_url).map_err(|e| format!("Failed to create RPC client: {}", e))?;

    let xdr_bytes = base64::decode(signed_xdr).map_err(|e| format!("Invalid XDR base64: {}", e))?;
    let tx_envelope = TransactionEnvelope::from_xdr(&xdr_bytes, Limits::none())
        .map_err(|e| format!("Failed to parse XDR: {}", e))?;

    let result = client.send_transaction_polling(&tx_envelope)
        .await
        .map_err(|e| format!("Failed to submit transaction: {}", e))?;

    let result_json = serde_json::to_value(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e))?;

    Ok(result_json)
}

fn extract_split_id_from_result(result: &serde_json::Value) -> Option<u64> {
    result.get("result")?
        .get("retval")?
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
}

async fn invoke_create_split_on_contract(
    contract: &ContractConfig,
    _creator: &str,
    _total_xlm: f64,
    _participants: &[String],
) -> Result<u64, String> {
    Err("Direct contract invocation is deprecated. Use the /api/splits/build and /api/splits/submit endpoints with wallet signing.".to_string())
}

async fn invoke_pay_share_on_contract(
    _contract: &ContractConfig,
    _split_id: u64,
    _payer: &str,
) -> Result<(), String> {
    Err("Direct contract invocation is deprecated. Use the /api/splits/{id}/pay/build and /api/splits/{id}/pay/submit endpoints with wallet signing.".to_string())
}

async fn invoke_get_split_on_contract(contract: &ContractConfig, split_id: u64) -> Result<String, String> {
    let contract_id = contract
        .contract_id
        .clone()
        .ok_or_else(|| "SPLITPAY_CONTRACT_ID is not configured".to_string())?;

    let output = Command::new("soroban")
        .arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--rpc-url")
        .arg(&contract.rpc_url)
        .arg("--network-passphrase")
        .arg(&contract.network_passphrase)
        .arg("--")
        .arg("get_split")
        .arg("--split_id")
        .arg(split_id.to_string())
        .output()
        .map_err(|e| format!("Failed to invoke soroban CLI: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn invoke_get_payment_status_on_contract(
    contract: &ContractConfig,
    split_id: u64,
    participant: &str,
) -> Result<bool, String> {
    let contract_id = contract
        .contract_id
        .clone()
        .ok_or_else(|| "SPLITPAY_CONTRACT_ID is not configured".to_string())?;

    let output = Command::new("soroban")
        .arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--rpc-url")
        .arg(&contract.rpc_url)
        .arg("--network-passphrase")
        .arg(&contract.network_passphrase)
        .arg("--")
        .arg("get_payment_status")
        .arg("--split_id")
        .arg(split_id.to_string())
        .arg("--participant")
        .arg(participant)
        .output()
        .map_err(|e| format!("Failed to invoke soroban CLI: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_bool_output(&stdout)
        .ok_or_else(|| format!("Could not parse payment status from soroban output: {stdout}"))
}

async fn invoke_is_settled_on_contract(contract: &ContractConfig, split_id: u64) -> Result<bool, String> {
    let contract_id = contract
        .contract_id
        .clone()
        .ok_or_else(|| "SPLITPAY_CONTRACT_ID is not configured".to_string())?;

    let output = Command::new("soroban")
        .arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--rpc-url")
        .arg(&contract.rpc_url)
        .arg("--network-passphrase")
        .arg(&contract.network_passphrase)
        .arg("--")
        .arg("is_settled")
        .arg("--split_id")
        .arg(split_id.to_string())
        .output()
        .map_err(|e| format!("Failed to invoke soroban CLI: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_bool_output(&stdout)
        .ok_or_else(|| format!("Could not parse settlement status from soroban output: {stdout}"))
}

fn parse_first_u64(s: &str) -> Option<u64> {
    let mut buf = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            buf.push(ch);
        } else if !buf.is_empty() {
            break;
        }
    }
    if buf.is_empty() {
        None
    } else {
        buf.parse::<u64>().ok()
    }
}

fn parse_bool_output(s: &str) -> Option<bool> {
    let normalized = s.trim().to_ascii_lowercase();
    if normalized.contains("true") {
        Some(true)
    } else if normalized.contains("false") {
        Some(false)
    } else {
        None
    }
}

fn not_found(message: &'static str) -> impl FnOnce() -> (StatusCode, Json<ApiError>) {
    move || {
        (
            StatusCode::NOT_FOUND,
            Json(ApiError {
                message: message.to_string(),
            }),
        )
    }
}

fn bad_request(message: &'static str) -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiError {
            message: message.to_string(),
        }),
    )
}

fn bad_request_owned(message: String) -> (StatusCode, Json<ApiError>) {
    (StatusCode::BAD_REQUEST, Json(ApiError { message }))
}
