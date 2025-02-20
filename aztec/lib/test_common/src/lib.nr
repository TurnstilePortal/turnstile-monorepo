use aztec::{
    protocol_types::{address::AztecAddress, traits::ToField},
    test::helpers::test_environment::TestEnvironment,
};

// Setup a test environment with N accounts
pub unconstrained fn setup_env_and_accounts<let N: u32>() -> (&mut TestEnvironment, [AztecAddress; N]) {
    let mut env = TestEnvironment::new();
    let mut accounts = [AztecAddress::zero(); N];
    for i in 0..N {
        accounts[i] = env.create_account_contract(i.to_field());
    }

    env.advance_block_by(1);
    (&mut env, accounts)
}

// Setup N accounts in the provided test environment
pub unconstrained fn setup_accounts<let N: u32>(env: &mut TestEnvironment) -> [AztecAddress; N] {
    let mut accounts = [AztecAddress::zero(); N];
    for i in 0..N {
        accounts[i] = env.create_account_contract(i.to_field());
    }

    env.advance_block_by(1);
    accounts
}
