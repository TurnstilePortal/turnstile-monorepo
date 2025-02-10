use crate::ShieldGatewayStorage;
use aztec::{
    oracle::execution::get_contract_address,
    protocol_types::address::AztecAddress,
    test::helpers::{
        cheatcodes,
        test_environment::TestEnvironment,
    },
};
use test_common;

pub unconstrained fn deploy_shield_gateway_storage(
    env: &mut TestEnvironment,
    admin: AztecAddress,
    caller: AztecAddress,
) -> AztecAddress {
    let init_call = ShieldGatewayStorage::interface().init(admin);
    let storage = env
        .deploy("./@shield_gateway_storage", "ShieldGatewayStorage")
        .with_public_void_initializer(init_call);
    if caller != AztecAddress::zero() {
        set_authorized_caller(env, storage.to_address(), admin, caller);
    }
    storage.to_address()
}

pub unconstrained fn set_authorized_caller(env: &mut TestEnvironment, storage_address: AztecAddress, admin: AztecAddress, caller: AztecAddress) {
    env.impersonate(admin);
    ShieldGatewayStorage::at(storage_address)
        .set_authorized_caller(caller)
        .call(&mut env.public());

    // advance to when private state is available
    env.advance_block_by(ShieldGatewayStorage::CHANGE_DELAY_BLOCKS + 1);
}

pub(crate) unconstrained fn is_channel_initialized(storage_address: AztecAddress, key: Field) -> bool {
    let current = get_contract_address();
    cheatcodes::set_contract_address(storage_address);
    let is_initialized = ShieldGatewayStorage::is_channel_initialized_unconstrained(key);
    cheatcodes::set_contract_address(current);
    is_initialized
}

pub(crate) unconstrained fn setup_storage<let N: u32>() -> (&mut TestEnvironment, AztecAddress, [AztecAddress; N]) {
    let (mut env, accounts) = test_common::setup_env_and_accounts::<N>();
    let admin = accounts[0];
    let caller = accounts[1];

    let storage_address = deploy_shield_gateway_storage(env, admin, caller);
    (env, storage_address, accounts)
}
