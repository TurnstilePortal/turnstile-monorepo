use crate::test::utils;
use crate::Token;

use authwit::cheatcodes as authwit_cheatcodes;

#[test]
unconstrained fn transfer_private_to_private() {
    let (env, accounts) = utils::setup::<4>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let shield_gateway = accounts[3];
    let token = utils::deploy_token(env, minter, shield_gateway);
    let amount = 1000000000000000000.to_field();

    utils::mint_shielded(env, token, minter, sender, amount);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    let transfer_private_call_interface =
        Token::at(token).transfer_private_to_private(sender, recipient, amount, 1);

    authwit_cheatcodes::add_private_authwit_from_call_interface(
        sender,
        shield_gateway,
        transfer_private_call_interface,
    );

    // The shield gateway should be the only one able to call this function
    env.impersonate(shield_gateway);
    transfer_private_call_interface.call(&mut env.private());

    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}

#[test]
unconstrained fn transfer_private_to_private_twice() {
    let (env, accounts) = utils::setup::<4>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let shield_gateway = accounts[3];
    let token = utils::deploy_token(env, minter, shield_gateway);
    let amount = 1000000000000000000.to_field();
    let half = amount / 2;

    utils::mint_shielded(env, token, minter, sender, amount);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    let transfer_private_call_interface =
        Token::at(token).transfer_private_to_private(sender, recipient, half, 1);

    authwit_cheatcodes::add_private_authwit_from_call_interface(
        sender,
        shield_gateway,
        transfer_private_call_interface,
    );


    // The shield gateway should be the only one able to call this function
    env.impersonate(shield_gateway);
    transfer_private_call_interface.call(&mut env.private());

    let transfer_private_call_interface2 =
        Token::at(token).transfer_private_to_private(sender, recipient, half, 2);

    authwit_cheatcodes::add_private_authwit_from_call_interface(
        sender,
        shield_gateway,
        transfer_private_call_interface2,
    );
    transfer_private_call_interface2.call(&mut env.private());


    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}

#[test(should_fail_with = "Private transfer must be initiated from the shield gateway")]
unconstrained fn transfer_private_to_private_without_shield_gateway_fails() {
    let (env, accounts) = utils::setup::<4>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let shield_gateway = accounts[3];
    let token = utils::deploy_token(env, minter, shield_gateway);
    let amount = 1000000000000000000.to_field();

    utils::mint_shielded(env, token, minter, sender, amount);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    let transfer_private_call_interface =
        Token::at(token).transfer_private_to_private(sender, recipient, amount, 1);

    authwit_cheatcodes::add_private_authwit_from_call_interface(
        sender,
        sender,
        transfer_private_call_interface,
    );

    // The shield gateway should be the only one able to call transfer_private_to_private
    env.impersonate(sender);
    transfer_private_call_interface.call(&mut env.private());

    assert(
        false,
        "Token::transfer_private_to_private should fail if the caller is not the shield gateway",
    );
}
