use aztec::{
    oracle::random::random,
    prelude::AztecAddress,
    test::helpers::test_environment::TestEnvironment,
};
use authwit::cheatcodes as authwit_cheatcodes;

use crate::ShieldGateway;
use token::Token;
use shield_gateway_storage::test::utils as shield_gateway_storage_utils;

pub unconstrained fn deploy_shield_gateway(
    env: &mut TestEnvironment,
    admin: AztecAddress,
    default_threshold: Field,
) -> AztecAddress {
    let storage = shield_gateway_storage_utils::deploy_shield_gateway_storage(env, admin, AztecAddress::zero());

    let init_call = ShieldGateway::interface().init(admin, storage, default_threshold);
    let shield_gateway =
        env.deploy("./@shield_gateway", "ShieldGateway").with_public_void_initializer(init_call);
    // advance to when shield gateway private state is initialized
    env.advance_block_by(ShieldGateway::CHANGE_DELAY_BLOCKS + 1);

    shield_gateway_storage_utils::set_authorized_caller(env, storage, admin, shield_gateway.to_address());
    shield_gateway.to_address()
}

pub unconstrained fn channel_transfer(
    env: &mut TestEnvironment,
    shield_gateway: AztecAddress,
    token: AztecAddress,
    sender: AztecAddress,
    recipient: AztecAddress,
    amount: Field,
) {
    let nonce = random();
    let transfer_private_call_interface =
        Token::at(token).transfer_private_to_private(sender, recipient, amount, nonce);

    authwit_cheatcodes::add_private_authwit_from_call_interface(
        sender,
        shield_gateway,
        transfer_private_call_interface,
    );

    ShieldGateway::at(shield_gateway).channel_transfer(token, sender, recipient, amount, nonce).call(&mut env.private());
    env.advance_block_by(3);
}
