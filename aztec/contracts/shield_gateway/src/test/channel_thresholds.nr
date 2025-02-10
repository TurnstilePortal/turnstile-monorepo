use aztec::{
    oracle::execution::get_contract_address,
    protocol_types::{
        address::AztecAddress,
        traits::{FromField, ToField},
    },
    test::helpers::cheatcodes,
};

use uint253::uint253::U253;
use shield_gateway_storage::ShieldGatewayStorage;
use test_common;

use crate::ShieldGateway;
use crate::test::utils;

#[test]
unconstrained fn initialize_default_threshold() {
    let threshold = 10_000;

    let (env, accounts) = test_common::setup_env_and_accounts::<1>();
    let admin = accounts[0];

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);

    let current = get_contract_address();
    cheatcodes::set_contract_address(shield_gateway_address);
    let default_threshold = ShieldGateway::get_default_channel_threshold();
    assert(default_threshold == threshold, f"Default threshold not initialized correctly: expected {threshold}, got {default_threshold}");
    cheatcodes::set_contract_address(current);
}

#[test]
unconstrained fn set_default_channel_threshold() {
    let threshold = 0x1000;
    let new_threshold = 0x2000;

    let (env, accounts) = test_common::setup_env_and_accounts::<1>();
    let admin = accounts[0];

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);
    let shield_gateway = ShieldGateway::at(shield_gateway_address);

    env.impersonate(admin);
    shield_gateway.set_default_channel_threshold(new_threshold).call(&mut env.public());

    // Advance to when the threshold is updated
    env.advance_block_by(ShieldGateway::CHANGE_DELAY_BLOCKS + 1);

    let current = get_contract_address();
    cheatcodes::set_contract_address(shield_gateway_address);
    let default_threshold = ShieldGateway::get_default_channel_threshold();
    assert(default_threshold == new_threshold, f"Default threshold not set correctly: expected {new_threshold}, got {default_threshold}");
    cheatcodes::set_contract_address(current);
}

#[test]
unconstrained fn set_override_channel_threshold() {
    let default_threshold = 0x1000;
    let specific_threshold = U253::from_field(0x2000);

    let (env, accounts) = test_common::setup_env_and_accounts::<1>();
    let admin = accounts[0];
    let token = AztecAddress::from_field(0x1234567890);

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, default_threshold);
    let shield_gateway = ShieldGateway::at(shield_gateway_address);

    env.impersonate(admin);
    shield_gateway.set_channel_threshold(token, specific_threshold.to_field()).call(&mut env.public());

    // Advance to when the threshold is updated
    env.advance_block_by(ShieldGatewayStorage::CHANGE_DELAY_BLOCKS + 1);

    let configured_threshold = shield_gateway.get_channel_threshold(token).view(&mut env.public());
    assert(configured_threshold == specific_threshold, f"Channel threshold not set correctly: expected {specific_threshold}, got {configured_threshold}");

    let current = get_contract_address();
    cheatcodes::set_contract_address(shield_gateway_address);
    let configured_default_threshold = ShieldGateway::get_default_channel_threshold();
    assert(configured_default_threshold == default_threshold, f"Default threshold should not have changed: expected {default_threshold}, got {configured_default_threshold}");
    cheatcodes::set_contract_address(current);
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn set_default_channel_threshold_fails_when_not_admin() {
    let default_threshold = 0x9;
    let new_threshold = 0x8;

    let (env, accounts) = test_common::setup_env_and_accounts::<2>();
    let admin = accounts[0];
    let non_admin = accounts[1];

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, default_threshold);
    let shield_gateway = ShieldGateway::at(shield_gateway_address);

    env.impersonate(non_admin);
    shield_gateway.set_default_channel_threshold(new_threshold).call(&mut env.public());
    assert(false, "set_default_channel_threshold should fail when not admin");
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn set_channel_threshold_fails_when_not_admin() {
    let default_threshold = 10_000;
    let token_threshold = 20_000;
    let token = AztecAddress::from_field(0x1234567890);

    let (env, accounts) = test_common::setup_env_and_accounts::<2>();
    let admin = accounts[0];
    let non_admin = accounts[1];

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, default_threshold);

    let shield_gateway = ShieldGateway::at(shield_gateway_address);

    env.impersonate(non_admin);
    shield_gateway.set_channel_threshold(token, token_threshold).call(&mut env.public());
    assert(false, "set_channel_threshold should fail when not admin");
}
