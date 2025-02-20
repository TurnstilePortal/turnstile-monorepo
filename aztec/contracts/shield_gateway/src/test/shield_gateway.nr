use crate::ShieldGateway;
use crate::test::utils::deploy_shield_gateway;

use aztec::{
    oracle::execution::get_contract_address,
    protocol_types::address::AztecAddress,
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
};

use test_common;
use uint253::uint253::U253;

#[test]
unconstrained fn test_binned() {
    let (env, _) = test_common::setup_env_and_accounts::<1>();
    let gw_address = deploy_shield_gateway(env);

    let current = get_contract_address();

    cheatcodes::set_contract_address(gw_address);

    let binned = ShieldGateway::_binned(U253::new_unchecked(5_000_000_000_000_000_000_000));
    // Bin amount is 1_000_000_000
    assert(
        binned == U253::new_unchecked(5_000_000_000_000),
        f"Bin amount {binned} is not 5_000_000_000_000",
    );
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000_000_000_000_000_000_000));
    assert(
        binned == U253::new_unchecked(1_000_000_000_000),
        f"Bin amount {binned} is not 1_000_000_000_000",
    );
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000_000_000_000_000_000));
    assert(
        binned == U253::new_unchecked(1_000_000_000),
        f"Bin amount {binned} is not 1_000_000_000",
    );
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000_000_000_000));
    assert(binned == U253::new_unchecked(1_000), f"Bin amount {binned} is not 1_000");
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000_000_000));
    assert(binned == U253::new_unchecked(1), f"Bin amount {binned} is not 1");
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000_000));
    assert(binned.is_zero(), f"Bin amount {binned} is not zero");
    let binned = ShieldGateway::_binned(U253::new_unchecked(1_000));
    assert(binned.is_zero(), f"Bin amount {binned} is not zero");
    let binned = ShieldGateway::_binned(U253::new_unchecked(1));
    assert(binned.is_zero(), f"Bin amount {binned} is not zero");

    cheatcodes::set_contract_address(current);
}
