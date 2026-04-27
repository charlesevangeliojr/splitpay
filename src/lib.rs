#![no_std]

use soroban_sdk::{contract, contractimpl, token, Env, Address, Symbol, Vec, contracttype};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub split_id: u64,
    pub creator: Address,
    pub total_amount: i128,
    pub amount_per_person: i128,
    pub participants: Vec<Address>,
    pub token: Address,
    pub status: SplitStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SplitStatus {
    Active,
    Settled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Split(u64),
    Payment(u64, Address),
    SplitCount,
}

#[contract]
pub struct SplitPay;

#[contractimpl]
impl SplitPay {
    pub fn create_split(
        env: &Env,
        creator: Address,
        total_amount: i128,
        participants: Vec<Address>,
        token: Address,
    ) -> u64 {
        creator.require_auth();

        assert!(total_amount > 0, "Amount must be positive");
        assert!(!participants.is_empty(), "Must have participants");

        let split_id = Self::get_and_increment_split_count(env);
        let num_participants = participants.len() as i128;
        let amount_per_person = total_amount / num_participants;

        let split = Split {
            split_id,
            creator: creator.clone(),
            total_amount,
            amount_per_person,
            participants: participants.clone(),
            token,
            status: SplitStatus::Active,
        };

        env.storage().persistent().set(&DataKey::Split(split_id), &split);

        for participant in participants.iter() {
            env.storage().persistent().set(
                &DataKey::Payment(split_id, participant.clone()),
                &false,
            );
        }

        env.events().publish(
            (Symbol::new(env, "split_created"), split_id),
            (creator, total_amount, participants),
        );

        split_id
    }

    pub fn pay_share(env: &Env, split_id: u64, participant: Address) {
        participant.require_auth();

        let split: Split = env.storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("Split not found");

        assert!(
            matches!(split.status, SplitStatus::Active),
            "Split is not active"
        );

        let is_participant = split.participants.iter().any(|p| p == participant);
        assert!(is_participant, "Not a participant in this split");

        let already_paid: bool = env.storage()
            .persistent()
            .get(&DataKey::Payment(split_id, participant.clone()))
            .unwrap_or(false);
        assert!(!already_paid, "Already paid");

        let token_client = token::Client::new(env, &split.token);
        token_client.transfer(
            &participant,
            &split.creator,
            &split.amount_per_person,
        );

        env.storage().persistent().set(
            &DataKey::Payment(split_id, participant.clone()),
            &true,
        );

        env.events().publish(
            (Symbol::new(env, "share_paid"), split_id),
            (participant.clone(), split.amount_per_person),
        );

        if Self::is_settled(env, split_id) {
            let mut updated_split = split;
            updated_split.status = SplitStatus::Settled;
            env.storage().persistent().set(&DataKey::Split(split_id), &updated_split);

            env.events().publish(
                (Symbol::new(env, "split_settled"), split_id),
                (),
            );
        }
    }

    pub fn get_split(env: &Env, split_id: u64) -> Split {
        env.storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("Split not found")
    }

    pub fn get_payment_status(env: &Env, split_id: u64, participant: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(split_id, participant))
            .unwrap_or(false)
    }

    pub fn is_settled(env: &Env, split_id: u64) -> bool {
        let split: Split = env.storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("Split not found");

        if matches!(split.status, SplitStatus::Settled) {
            return true;
        }

        for participant in split.participants.iter() {
            let paid: bool = env.storage()
                .persistent()
                .get(&DataKey::Payment(split_id, participant))
                .unwrap_or(false);
            if !paid {
                return false;
            }
        }

        true
    }

    fn get_and_increment_split_count(env: &Env) -> u64 {
        let count: u64 = env.storage().instance().get(&DataKey::SplitCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::SplitCount, &(count + 1));
        count + 1
    }
}