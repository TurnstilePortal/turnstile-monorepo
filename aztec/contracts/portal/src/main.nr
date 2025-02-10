mod constants;
mod encoding;

use aztec::macros::aztec;

#[aztec]
pub contract Portal {
    use std::meta::derive;

    use aztec::{
        hash::hash_args,
        macros::{
            events::event,
            functions::{initializer, internal, private, public, initialization_utils::compute_initialization_hash},
            storage::storage,
        },
        protocol_types::{
            address::{AztecAddress, EthAddress, PartialAddress},
            contract_class_id::ContractClassId,
            public_keys::PublicKeys,
            traits::Serialize,
        },
        state_vars::{Map, PublicImmutable},
        unencrypted_logs::unencrypted_event_emission::encode_event,
    };

    use authwit::auth::assert_current_call_valid_authwit_public;

    use token::Token;

    use crate::{
        constants::PUBLIC_NOT_SECRET_SECRET,
        encoding::{
            deposit::deposit_content_hash, register::register_content_hash,
            withdraw::withdraw_content_hash,
        },
    };

    #[storage]
    struct Storage<Context> {
        l1_portal: PublicImmutable<EthAddress, Context>,
        l1_tokens: Map<EthAddress, PublicImmutable<AztecAddress, Context>, Context>,
        l2_tokens: Map<AztecAddress, PublicImmutable<EthAddress, Context>, Context>,
        token_contract_class_id: PublicImmutable<ContractClassId, Context>,
        shield_gateway_beacon: PublicImmutable<AztecAddress, Context>,
    }

    #[derive(Serialize)]
    #[event]
    struct Register {
        eth_token: EthAddress,
        aztec_token: AztecAddress,
    }

    #[derive(Serialize)]
    #[event]
    struct Deposit {
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: Field,
        message_leaf_index: Field,
    }

    #[derive(Serialize)]
    #[event]
    struct Withdraw {
        token: EthAddress,
        from: AztecAddress,
        to: EthAddress,
        amount: Field,
    }

    #[public]
    #[initializer]
    fn constructor(
        l1_portal: Field,
        token_contract_class: Field,
        shield_gateway_beacon: AztecAddress,
    ) {
        assert(l1_portal != 0, "L1 portal address cannot be zero");
        assert(token_contract_class != 0, "Token contract class cannot be zero");

        storage.l1_portal.initialize(EthAddress::from_field(l1_portal));
        storage.token_contract_class_id.initialize(ContractClassId::from_field(
            token_contract_class,
        ));
        storage.shield_gateway_beacon.initialize(shield_gateway_beacon);
    }

    #[private]
    fn register_private(
        eth_token: Field,
        aztec_token: AztecAddress,
        name: str<31>,
        name_len: u8,
        symbol: str<31>,
        symbol_len: u8,
        decimals: u8,
        message_leaf_index: Field,
    ) {
        aztec::oracle::debug_log::debug_log_format(
            "Registering L1 token {0} as L2 token {1}",
            [eth_token, aztec_token.to_field()],
        );

        let eth_token = EthAddress::from_field(eth_token);

        assert(storage.l1_tokens.at(eth_token).read().is_zero(), "Token already registered");

        // L1->L2 message content hash from token name, symbol, decimals
        let content_hash =
            register_content_hash(eth_token, name, name_len, symbol, symbol_len, decimals);
        aztec::oracle::debug_log::debug_log_format("Register content hash: {0}", [content_hash]);

        // Set the shield gateway beacon
        Token::at(aztec_token).set_shield_gateway_beacon(storage.shield_gateway_beacon.read()).enqueue(&mut context);

        // Ensure the supplied token address matches the expected address. This ensures its deployed with
        // the correct code and initialization parameters.
        let initializer = Token::interface().init(
            context.this_address(),
            name,
            symbol,
            decimals,
        );
        let args_hash = hash_args(initializer.args);
        let init_hash = compute_initialization_hash(initializer.selector, args_hash);
        let partial_address = PartialAddress::compute(
            storage.token_contract_class_id.read(),
            0x9876543210, // salt, hardcoded
            init_hash,
            AztecAddress::from_field(0),
        );

        let computed_address = AztecAddress::compute(PublicKeys::default(), partial_address);
        // aztec::oracle::debug_log::debug_log_format(
        //     "Supplied Address: {0}, Computed address: {1}",
        //     [aztec_token.to_field(), computed_address.to_field()]
        // );
        // aztec::oracle::debug_log::debug_log_format("Gas left 4: {0}", [context.l2_gas_left()]);
        assert(
            computed_address == aztec_token,
            "Expected address did not match supplized token address",
        );

        // Consume the message
        aztec::oracle::debug_log::debug_log_format(
            "Consuming message with leaf index {0}",
            [message_leaf_index],
        );

        let l1Portal = storage.l1_portal.read();
        aztec::oracle::debug_log::debug_log_format("L1 Portal: {0}", [l1Portal.to_field()]);

        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            storage.l1_portal.read(),
            message_leaf_index,
        );

        Portal::at(context.this_address())._register_public(aztec_token, eth_token).enqueue(
            &mut context,
        );
    }

    #[public]
    #[internal]
    fn _register_public(aztec_token: AztecAddress, eth_token: EthAddress) {
        // Initialize the token mappings
        storage.l1_tokens.at(eth_token).initialize(aztec_token);
        storage.l2_tokens.at(aztec_token).initialize(eth_token);
        Register { eth_token, aztec_token }.emit(encode_event(&mut context));
    }

    #[private]
    fn claim_public(
        eth_token: Field,
        recipient: AztecAddress,
        amount: Field,
        message_leaf_index: Field,
    ) {
        let eth_token = EthAddress::from_field(eth_token);

        let content_hash = deposit_content_hash(eth_token, recipient, amount);
        aztec::oracle::debug_log::debug_log_format("Deposit content hash: {0}", [content_hash]);

        // Consume the message
        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            storage.l1_portal.read(),
            message_leaf_index,
        );

        Portal::at(context.this_address())
            ._claim_public(eth_token, recipient, amount, message_leaf_index)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _claim_public(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: Field,
        message_leaf_index: Field,
    ) {
        Token::at(storage.l1_tokens.at(eth_token).read()).mint_public(recipient, amount).call(
            &mut context,
        );

        Portal::at(context.this_address())
            ._log_claim(eth_token, recipient, amount, message_leaf_index)
            .call(&mut context);
    }

    #[private]
    fn claim_shielded(
        eth_token: Field,
        recipient: AztecAddress,
        amount: Field,
        message_leaf_index: Field,
    ) {
        let eth_token = EthAddress::from_field(eth_token);

        let content_hash = deposit_content_hash(eth_token, recipient, amount);
        aztec::oracle::debug_log::debug_log_format("Deposit content hash: {0}", [content_hash]);

        // Consume the message
        context.consume_l1_to_l2_message(
            content_hash,
            PUBLIC_NOT_SECRET_SECRET,
            storage.l1_portal.read(),
            message_leaf_index,
        );

        Token::at(storage.l1_tokens.at(eth_token).read()).mint_shielded(recipient, amount).call(
            &mut context,
        );

        Portal::at(context.this_address())
            ._log_claim(eth_token, recipient, amount, message_leaf_index)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _log_claim(
        eth_token: EthAddress,
        recipient: AztecAddress,
        amount: Field,
        message_leaf_index: Field,
    ) {
        Deposit { eth_token, recipient, amount, message_leaf_index }.emit(encode_event(
            &mut context,
        ));
    }

    #[public]
    fn withdraw_public(
        eth_token: EthAddress,
        from: AztecAddress,
        recipient: EthAddress,
        amount: Field,
        withdrawNonce: Field,
        burnNonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(withdrawNonce == 0, "Invalid nonce");
        }

        // Burn the tokens
        Token::at(storage.l1_tokens.at(eth_token).read()).burn_public(from, amount, burnNonce).call(
            &mut context,
        );

        // Message the L1 Portal
        let content_hash = withdraw_content_hash(eth_token, recipient, amount);
        context.message_portal(storage.l1_portal.read(), content_hash);

        aztec::oracle::debug_log::debug_log_format("Withdraw L2ToL1 Message {0}", [content_hash]);

        Withdraw { token: eth_token, from, to: recipient, amount }.emit(encode_event(&mut context));
    }

    unconstrained fn is_registered_l1(eth_token: Field) -> pub bool {
        let eth_token = EthAddress::from_field(eth_token);
        !storage.l1_tokens.at(eth_token).read().is_zero()
    }

    unconstrained fn is_registered_l2(aztec_token: AztecAddress) -> pub bool {
        !storage.l2_tokens.at(aztec_token).read().is_zero()
    }

    unconstrained fn get_l2_token(eth_token: Field) -> pub AztecAddress {
        let eth_token = EthAddress::from_field(eth_token);
        storage.l1_tokens.at(eth_token).read()
    }

    unconstrained fn get_l1_token(aztec_token: AztecAddress) -> pub EthAddress {
        storage.l2_tokens.at(aztec_token).read()
    }

    unconstrained fn get_l1_portal() -> pub EthAddress {
        storage.l1_portal.read()
    }
}
