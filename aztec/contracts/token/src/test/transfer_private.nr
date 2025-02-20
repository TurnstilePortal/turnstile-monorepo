use crate::test::utils;
use crate::Token;
use shield_gateway::ShieldGateway;
use test_common;

use aztec::oracle::{capsules, random::random};

#[test]
unconstrained fn transfer_private_to_private() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];

    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000.to_field();

    env.impersonate(minter);
    Token::at(token).mint_shielded(sender, amount).call(&mut env.private());
    env.advance_block_by(2);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    // Add capsule for shieldgateway
    utils::store_vp_capsule(env, token);

    env.impersonate(sender);
    Token::at(token).transfer_private_to_private(sender, recipient, amount, 0).call(
        &mut env.private(),
    );
    env.advance_block_by(2);

    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}

#[test]
unconstrained fn transfer_private_to_private_twice() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000.to_field();
    let half = amount / 2;

    env.impersonate(minter);
    Token::at(token).mint_shielded(sender, amount).call(&mut env.private());
    env.advance_block_by(2);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    // Add capsule for shieldgateway
    utils::store_vp_capsule(env, token);

    env.impersonate(sender);
    Token::at(token).transfer_private_to_private(sender, recipient, half, 0).call(&mut env.private());
    env.advance_block_by(1);

    // Add another capsule for shieldgateway
    utils::store_vp_capsule(env, token);

    Token::at(token).transfer_private_to_private(sender, recipient, half, 0).call(&mut env.private());
    env.advance_block_by(1);

    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}
