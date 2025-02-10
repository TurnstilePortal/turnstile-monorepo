use crate::test::utils;
use crate::ShieldGateway;
use test_common;
use token::test::utils as token_utils;

#[test]
unconstrained fn channel_initialize() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();
    let admin = accounts[0];
    let alice = accounts[1];
    let bob = accounts[2];

    let threshold = 0x10000;

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);
    let token = token_utils::deploy_token(env, admin, shield_gateway_address);

    let shield_gateway = ShieldGateway::at(shield_gateway_address);
    env.impersonate(alice);
    shield_gateway.initialize_channel(alice, bob, token, 0 /* nonce */).call(&mut env.private());

    let channel_balance = shield_gateway.get_channel_balance(alice, bob, token).view(&mut env.private());
    assert(channel_balance == 0, "Channel balance should be 0");
}

#[test (should_fail_with = "Failed to get a note")]
unconstrained fn get_channel_balance_fails_before_initialization() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();
    let admin = accounts[0];
    let alice = accounts[1];
    let bob = accounts[2];

    let threshold = 0x10000;

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);
    let token = token_utils::deploy_token(env, admin, shield_gateway_address);

    let shield_gateway = ShieldGateway::at(shield_gateway_address);
    env.impersonate(alice);

    // This should fail
    let _ = shield_gateway.get_channel_balance(alice, bob, token).view(&mut env.private());
}

#[test]
unconstrained fn channel_transfer_multiple_within_threshold() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();
    let admin = accounts[0];
    let alice = accounts[1];
    let bob = accounts[2];

    let threshold = 0x6000;

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);

    let token = token_utils::deploy_token(env, admin, shield_gateway_address);
    let amount_to_mint = 0x50000000000;

    // Mint shielded tokens
    token_utils::mint_shielded(env, token, admin, alice, amount_to_mint);
    // Sanity check
    token_utils::check_balance_private(token, alice, amount_to_mint);


    // initialize channel
    env.impersonate(alice);
    ShieldGateway::at(shield_gateway_address).initialize_channel(alice, bob, token, 0 /* nonce */).call(&mut env.private());

    let amount = threshold / 2 - 2;
    // initial transfer
    utils::channel_transfer(env, shield_gateway_address, token, alice, bob, amount);

    // Sanity check
    token_utils::check_balance_private(token, alice, amount_to_mint - amount);
    token_utils::check_balance_private(token, bob, amount);

    env.advance_block_by(10);

    // second transfer
    utils::channel_transfer(env, shield_gateway_address, token, alice, bob, amount);


    let total = amount * 2;
    token_utils::check_balance_private(token, alice, amount_to_mint - total);
    token_utils::check_balance_private(token, bob, total);
}

#[test]
unconstrained fn channel_transfer_multiple_exceed_threshold() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();
    let admin = accounts[0];
    let alice = accounts[1];
    let bob = accounts[2];

    let threshold = 0x10000;

    let shield_gateway_address = utils::deploy_shield_gateway(env, admin, threshold);

    let token = token_utils::deploy_token(env, admin, shield_gateway_address);
    let amount_to_mint = 0x50000000000;

    // Mint shielded tokens
    token_utils::mint_shielded(env, token, admin, alice, amount_to_mint);

    // Sanity check
    token_utils::check_balance_private(token, alice, amount_to_mint);

    // initialize channel
    env.impersonate(alice);
    ShieldGateway::at(shield_gateway_address).initialize_channel(alice, bob, token, 0 /* nonce */).call(&mut env.private());

    let amount = threshold / 2 + 1;
    // initial transfer
    utils::channel_transfer(env, shield_gateway_address, token, alice, bob, amount);

    // second transfer
    utils::channel_transfer(env, shield_gateway_address, token, alice, bob, amount);

    let total = amount * 2;
    token_utils::check_balance_private(token, alice, amount_to_mint - total);
    token_utils::check_balance_private(token, bob, total);
}
