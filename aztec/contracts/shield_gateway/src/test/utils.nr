use aztec::{prelude::AztecAddress, test::helpers::test_environment::TestEnvironment};

pub unconstrained fn deploy_shield_gateway(env: &mut TestEnvironment) -> AztecAddress {
    let shield_gateway = env.deploy("./@shield_gateway", "ShieldGateway").without_initializer();
    shield_gateway.to_address()
}
