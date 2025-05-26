use crate::Beacon;
use aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

pub unconstrained fn deploy_beacon(
    env: &mut TestEnvironment,
    admin: AztecAddress,
    target: AztecAddress,
) -> AztecAddress {
    let init_call = Beacon::interface().init(admin, target);
    let beacon_address = env
        .deploy("./@beacon", "Beacon")
        .with_public_void_initializer(admin, init_call)
        .to_address();

    // Advance to when the private state is updated
    env.advance_block_by(Beacon::CHANGE_DELAY_BLOCKS + 1);
    beacon_address
}
