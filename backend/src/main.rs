use std::{
    collections::HashMap,
    net::SocketAddr,
    process::Command,
    sync::{Arc, RwLock},
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
struct ActivityQuery {
    filter: Option<String>,
}

#[derive(Debug, Serialize)]
struct ApiError {
    message: String,
}

#[tokio::main]
async fn main() {
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
        .allow_origin([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/session/connect", post(connect_wallet))
        .route("/api/session/{wallet}/disconnect", post(disconnect_wallet))
        .route("/api/session/{wallet}", get(get_session))
        .route("/api/splits", get(list_splits).post(create_split))
        .route("/api/splits/{id}", get(get_split))
        .route("/api/splits/{id}/pay", post(pay_share))
        .route("/api/activity", get(list_activity))
        .route("/api/settings/{wallet}", get(get_settings).patch(update_settings))
        .with_state(state)
        .layer(cors);

    let port = std::env::var("SPLITPAY_BACKEND_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

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
        let _ = invoke_get_split_on_contract(&state.contract, numeric_id);
        let settled = invoke_is_settled_on_contract(&state.contract, numeric_id).ok();

        let maybe_split = {
            let db = state.db.read().unwrap();
            db.splits.get(&key).cloned()
        };

        let Some(mut split) = maybe_split else {
            continue;
        };

        for participant in &mut split.participants {
            if let Ok(paid) =
                invoke_get_payment_status_on_contract(&state.contract, numeric_id, &participant.address)
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
    invoke_get_split_on_contract(&state.contract, numeric_id).map_err(bad_request_owned)?;
    let settled_on_chain = invoke_is_settled_on_contract(&state.contract, numeric_id).map_err(bad_request_owned)?;

    let mut split = {
        let db = state.db.read().unwrap();
        db.splits
            .get(&split_key)
            .cloned()
            .ok_or_else(not_found("Split not found in backend cache"))?
    };

    for participant in &mut split.participants {
        let paid = invoke_get_payment_status_on_contract(&state.contract, numeric_id, &participant.address)
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
    invoke_pay_share_on_contract(&state.contract, numeric_id, &payload.payer).map_err(bad_request_owned)?;

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

fn invoke_create_split_on_contract(
    contract: &ContractConfig,
    creator: &str,
    total_xlm: f64,
    participants: &[String],
) -> Result<u64, String> {
    let contract_id = contract
        .contract_id
        .clone()
        .ok_or_else(|| "SPLITPAY_CONTRACT_ID is not configured".to_string())?;

    let total_amount_stroops = (total_xlm * 10_000_000.0).round() as i128;
    let participants_arg = format!("[\"{}\"]", participants.join("\", \""));

    let output = Command::new("soroban")
        .arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--source")
        .arg(creator)
        .arg("--rpc-url")
        .arg(&contract.rpc_url)
        .arg("--network-passphrase")
        .arg(&contract.network_passphrase)
        .arg("--")
        .arg("create_split")
        .arg("--creator")
        .arg(creator)
        .arg("--total_amount")
        .arg(total_amount_stroops.to_string())
        .arg("--participants")
        .arg(participants_arg)
        .arg("--token")
        .arg(stellar_native_contract_address())
        .output()
        .map_err(|e| format!("Failed to invoke soroban CLI: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_first_u64(&stdout).ok_or_else(|| format!("Could not parse split id from soroban output: {stdout}"))
}

fn invoke_pay_share_on_contract(
    contract: &ContractConfig,
    split_id: u64,
    payer: &str,
) -> Result<(), String> {
    let contract_id = contract
        .contract_id
        .clone()
        .ok_or_else(|| "SPLITPAY_CONTRACT_ID is not configured".to_string())?;

    let output = Command::new("soroban")
        .arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--source")
        .arg(payer)
        .arg("--rpc-url")
        .arg(&contract.rpc_url)
        .arg("--network-passphrase")
        .arg(&contract.network_passphrase)
        .arg("--")
        .arg("pay_share")
        .arg("--split_id")
        .arg(split_id.to_string())
        .arg("--participant")
        .arg(payer)
        .output()
        .map_err(|e| format!("Failed to invoke soroban CLI: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

fn invoke_get_split_on_contract(contract: &ContractConfig, split_id: u64) -> Result<String, String> {
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

fn invoke_get_payment_status_on_contract(
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

fn invoke_is_settled_on_contract(contract: &ContractConfig, split_id: u64) -> Result<bool, String> {
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

fn stellar_native_contract_address() -> &'static str {
    "CDLZFC3SYQ4XGQYQK7K6D4L65Y2D4XQX3NPPQ4UYRDF6AFG7JYQJ4QXZ"
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
