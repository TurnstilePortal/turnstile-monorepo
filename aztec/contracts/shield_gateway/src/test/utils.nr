use aztec::{prelude::AztecAddress, test::helpers::test_environment::TestEnvironment};

use crate::ShieldGateway;

pub unconstrained fn deploy_shield_gateway(env: &mut TestEnvironment) -> AztecAddress {
    let admin = env.create_account(1);
    let init_call = ShieldGateway::interface().init();
    let shield_gateway =
        env.deploy("./@shield_gateway", "ShieldGateway").with_public_void_initializer(admin, init_call);
    shield_gateway.to_address()
}
