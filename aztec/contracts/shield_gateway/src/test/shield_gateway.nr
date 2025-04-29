use crate::ShieldGateway;
use crate::test::utils::deploy_shield_gateway;

use aztec::{
    oracle::execution::get_contract_address,
    protocol_types::address::AztecAddress,
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
};

use test_common;
use uint_note::uint_note::UintNote;

#[test]
unconstrained fn test_binned() {
    let (env, _) = test_common::setup_env_and_accounts::<1>();
    let gw_address = deploy_shield_gateway(env);

    let current = get_contract_address();

    cheatcodes::set_contract_address(gw_address);

    let binned = ShieldGateway::_binned(5_000_000_000_000_000_000_000);
    // Bin amount is 1_000_000_000
    assert(
        binned == 5_000_000_000_000,
        f"Bin amount {binned} is not 5_000_000_000_000",
    );
    let binned = ShieldGateway::_binned(1_000_000_000_000_000_000_000);
    assert(
        binned == 1_000_000_000_000,
        f"Bin amount {binned} is not 1_000_000_000_000",
    );
    let binned = ShieldGateway::_binned(1_000_000_000_000_000_000);
    assert(
        binned == 1_000_000_000,
        f"Bin amount {binned} is not 1_000_000_000",
    );
    let binned = ShieldGateway::_binned(1_000_000_000_000);
    assert(binned == 1_000, f"Bin amount {binned} is not 1_000");
    let binned = ShieldGateway::_binned(1_000_000_000);
    assert(binned == 1, f"Bin amount {binned} is not 1");
    let binned = ShieldGateway::_binned(1_000_000);
    assert(binned == 0, f"Bin amount {binned} is not zero");
    let binned = ShieldGateway::_binned(1_000);
    assert(binned == 0, f"Bin amount {binned} is not zero");
    let binned = ShieldGateway::_binned(1);
    assert(binned == 0, f"Bin amount {binned} is not zero");

    cheatcodes::set_contract_address(current);
}
