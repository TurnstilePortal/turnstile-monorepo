mod types;
mod test;

use aztec::macros::aztec;

// Minimal token implementation that supports `AuthWit` accounts.
// The auth message follows a similar pattern to the cross-chain message and includes a designated caller.
// The designated caller is ALWAYS used here, and not based on a flag as cross-chain.
// message hash = H([caller, contract, selector, ...args])
// To be read as `caller` calls function at `contract` defined by `selector` with `args`
// Including a nonce in the message hash ensures that the message can only be used once.
#[aztec]
pub contract Token {
    use std::{
        meta::derive,
        ops::{Add, Sub},
    };

    use compressed_string::FieldCompressedString;

    use aztec::{
        context::{PrivateCallInterface, PrivateContext},
        encrypted_logs::log_assembly_strategies::default_aes128::note::encode_and_encrypt_note,
        event::event_interface::EventInterface,
        macros::{
            events::event,
            functions::{initializer, internal, private, public, view},
            storage::storage,
        },
        note::note_interface::PartialNote,
        oracle::random::random,
        prelude::{
            AztecAddress, FunctionSelector, Map, PublicContext, PublicImmutable, PublicMutable,
        },
        protocol_types::{
            point::Point,
            traits::{
                Serialize,
                ToField,
            },
        },
        unencrypted_logs::unencrypted_event_emission::encode_event,
    };

    use authwit::auth::{
        assert_current_call_valid_authwit, assert_current_call_valid_authwit_public,
        compute_authwit_nullifier,
    };

    use beacon::Beacon;
    use shield_gateway::ShieldGateway;
    use uint_note::uint_note::UintNote;

    use crate::types::balance_set::BalanceSet;

    // In the first transfer iteration we are computing a lot of additional information (validating inputs, retrieving
    // keys, etc.), so the gate count is already relatively high. We therefore only read a few notes to keep the happy
    // case with few constraints.
    global INITIAL_TRANSFER_CALL_MAX_NOTES: u32 = 2;
    // All the recursive call does is nullify notes, meaning the gate count is low, but it is all constant overhead. We
    // therefore read more notes than in the base case to increase the efficiency of the overhead, since this results in
    // an overall small circuit regardless.
    global RECURSIVE_TRANSFER_CALL_MAX_NOTES: u32 = 8;

    #[derive(Serialize)]
    #[event]
    struct Mint {
        to: AztecAddress,
        amount: u128,
    }

    #[derive(Serialize)]
    #[event]
    struct Burn {
        from: AztecAddress,
        amount: u128,
    }

    #[derive(Serialize)]
    #[event]
    struct Shield {
        from: AztecAddress,
        amount: u128,
    }

    #[derive(Serialize)]
    #[event]
    struct Unshield {
        from: AztecAddress,
        amount: u128,
    }

    #[derive(Serialize)]
    #[event]
    struct Transfer {
        to: AztecAddress,
        amount: u128,
    }

    #[storage]
    struct Storage<Context> {
        minter: PublicImmutable<AztecAddress, Context>,
        shield_gateway_beacon: PublicImmutable<AztecAddress, Context>,
        private_balances: Map<AztecAddress, BalanceSet<Context>, Context>,
        public_balances: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

        total_supply: PublicMutable<u128, Context>,
        shielded_supply: PublicMutable<u128, Context>,

        name: PublicImmutable<FieldCompressedString, Context>,
        symbol: PublicImmutable<FieldCompressedString, Context>,
        decimals: PublicImmutable<u8, Context>,
    }

    #[public]
    #[initializer]
    fn init(minter: AztecAddress, name: str<31>, symbol: str<31>, decimals: u8) {
        assert(!minter.is_zero(), "invalid minter");
        assert(name.as_bytes().len() > 0, "Name cannot be empty");
        assert(symbol.as_bytes().len() > 0, "Symbol cannot be empty");

        storage.minter.initialize(minter);
        storage.name.initialize(FieldCompressedString::from_string(name));
        storage.symbol.initialize(FieldCompressedString::from_string(symbol));
        storage.decimals.initialize(decimals);
    }

    #[public]
    fn set_shield_gateway_beacon(beacon: AztecAddress) {
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");
        storage.shield_gateway_beacon.initialize(beacon);
    }

    #[public]
    #[view]
    fn public_get_name() -> FieldCompressedString {
        storage.name.read()
    }

    #[private]
    #[view]
    fn private_get_name() -> FieldCompressedString {
        storage.name.read()
    }

    #[public]
    #[view]
    fn public_get_symbol() -> pub FieldCompressedString {
        storage.symbol.read()
    }

    #[private]
    #[view]
    fn private_get_symbol() -> pub FieldCompressedString {
        storage.symbol.read()
    }

    #[public]
    #[view]
    fn public_get_decimals() -> pub u8 {
        storage.decimals.read()
    }

    #[private]
    #[view]
    fn private_get_decimals() -> pub u8 {
        storage.decimals.read()
    }

    #[public]
    #[view]
    fn total_supply() -> u128 {
        storage.total_supply.read()
    }

    #[public]
    #[view]
    fn shielded_supply() -> u128 {
        storage.shielded_supply.read()
    }

    #[public]
    #[view]
    fn balance_of_public(owner: AztecAddress) -> u128 {
        storage.public_balances.at(owner).read()
    }

    #[public]
    fn mint_public(to: AztecAddress, amount: u128) {
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");

        let new_balance = storage.public_balances.at(to).read().add(amount);
        let supply = storage.total_supply.read().add(amount);
        storage.public_balances.at(to).write(new_balance);
        storage.total_supply.write(supply);

        // Emit the mint event
        Mint { to, amount: amount }.emit(encode_event(&mut context));
    }

    #[public]
    fn transfer_public_to_public(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        let from_balance = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance);
        let to_balance = storage.public_balances.at(to).read().add(amount);
        storage.public_balances.at(to).write(to_balance);

        Transfer { to, amount }.emit(encode_event(&mut context));
    }

    #[public]
    fn burn_public(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let from_balance = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance);
        let new_supply = storage.total_supply.read().sub(amount);
        storage.total_supply.write(new_supply);

        Burn { from, amount }.emit(encode_event(&mut context));
    }

    #[private]
    fn transfer_private_to_public(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        assert_current_call_valid_authwit(&mut context, from);
        assert_shield_gateway_permitted(&mut context, storage, from, to, amount);

        storage.private_balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));
        Token::at(context.this_address())._increase_public_balance(to, amount).enqueue(&mut context);
    }

    #[contract_library_method]
    fn assert_shield_gateway_permitted(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        sender: AztecAddress,
        recipient: AztecAddress,
        amount: u128,
    ) {
        ShieldGateway::at(get_shield_gateway(context, storage))
            .check_transfer(sender, recipient, amount)
            .call(context);
    }

    #[contract_library_method]
    fn subtract_balance(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        account: AztecAddress,
        amount: u128,
        max_notes: u32,
    ) -> u128 {
        let subtracted = storage.private_balances.at(account).try_sub(amount, max_notes);
        // Failing to subtract any amount means that the owner was unable to produce more notes that could be nullified.
        // We could in some cases fail early inside try_sub if we detected that fewer notes than the maximum were
        // returned and we were still unable to reach the target amount, but that'd make the code more complicated, and
        // optimizing for the failure scenario is not as important.
        assert(subtracted > 0, "Balance too low");
        if subtracted >= amount {
            // We have achieved our goal of nullifying notes that add up to more than amount, so we return the change
            subtracted - amount
        } else {
            // try_sub failed to nullify enough notes to reach the target amount, so we compute the amount remaining
            // and try again.
            let remaining = amount - subtracted;
            compute_recurse_subtract_balance_call(*context, account, remaining).call(context)
        }
    }

    // TODO(#7729): apply no_predicates to the contract interface method directly instead of having to use a wrapper
    // like we do here.
    #[no_predicates]
    #[contract_library_method]
    fn compute_recurse_subtract_balance_call(
        context: PrivateContext,
        account: AztecAddress,
        remaining: u128,
    ) -> PrivateCallInterface<25, u128> {
        Token::at(context.this_address())._recurse_subtract_balance(account, remaining)
    }

    // TODO(#7728): even though the amount should be a u128, we can't have that type in a contract interface due to
    // serialization issues.
    #[internal]
    #[private]
    fn _recurse_subtract_balance(account: AztecAddress, amount: u128) -> u128 {
        subtract_balance(
            &mut context,
            storage,
            account,
            amount,
            RECURSIVE_TRANSFER_CALL_MAX_NOTES,
        )
    }

    /**
     * Cancel a private authentication witness.
     * @param inner_hash The inner hash of the authwit to cancel.
     */

    #[private]
    fn cancel_authwit(inner_hash: Field) {
        let on_behalf_of = context.msg_sender();
        let nullifier = compute_authwit_nullifier(on_behalf_of, inner_hash);
        context.push_nullifier(nullifier);
    }

    #[private]
    fn transfer_private_to_private(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        // Ensure that the transfer is permitted by the shield gateway
        assert_shield_gateway_permitted(&mut context, storage, from, to, amount);

        storage.private_balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));

        storage.private_balances.at(to).add(to, amount).emit(encode_and_encrypt_note(
            &mut context,
            to,
            from,
        ));
    }

    #[private]
    fn burn_private(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        storage.private_balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));
        Token::at(context.this_address())._reduce_total_supply(amount).enqueue(&mut context);
    }

    // Moves token `amount` from the user's public balance to their private balance.
    #[private]
    fn shield(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        Token::at(context.this_address())._transfer_public_to_private(from, from, amount).call(
            &mut context,
        );

        Token::at(context.this_address())._log_shield(from, amount).enqueue(&mut context);
    }

    #[private]
    fn unshield(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        storage.private_balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));
        Token::at(context.this_address())._increase_public_balance(from, amount).enqueue(
            &mut context,
        );
        Token::at(context.this_address())._log_unshield(from, amount).enqueue(&mut context);
    }

    // Transfers token `amount` from public balance of message sender to a private balance of `to`.
    #[private]
    fn transfer_public_to_private(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        assert_current_call_valid_authwit(&mut context, from);

        Token::at(context.this_address())._transfer_public_to_private(from, to, amount).call(
            &mut context,
        );
    }

    #[private]
    #[internal]
    fn _transfer_public_to_private(from: AztecAddress, to: AztecAddress, amount: u128) {
        let token = Token::at(context.this_address());

        // We prepare the private balance increase (the partial note).
        let hiding_point_slot = _prepare_private_balance_increase(from, to, &mut context, storage);

        // At last we finalize the transfer. Usage of the `unsafe` method here is safe because we set the `from`
        // function argument to a message sender, guaranteeing that he can transfer only his own tokens.
        token._finalize_transfer_public_to_private_unsafe(from, amount, hiding_point_slot).enqueue(
            &mut context,
        );
    }

    /// Prepares an increase of private balance of `to` (partial note). The increase needs to be finalized by calling
    /// some of the finalization functions (`finalize_transfer_public_to_private`, `finalize_mint_shielded`).
    /// Returns a hiding point slot.
    #[private]
    fn prepare_private_balance_increase(to: AztecAddress, from: AztecAddress) -> Field {
        // TODO(#9887): ideally we'd not have `from` here, but we do need a `from` address to produce a tagging secret
        // with `to`.
        _prepare_private_balance_increase(from, to, &mut context, storage)
    }

    /// This function exists separately from `prepare_private_balance_increase` solely as an optimization as it allows
    /// us to have it inlined in the `transfer_public_to_private` function which results in one less kernel iteration.
    ///
    /// TODO(#9180): Consider adding macro support for functions callable both as an entrypoint and as an internal
    /// function.
    #[contract_library_method]
    fn _prepare_private_balance_increase(
        from: AztecAddress, // recipient of the outgoing: TODO(#9887): this is not great?
        to: AztecAddress,
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
    ) -> Field {
        let to_note_slot = storage.private_balances.at(to).set.storage_slot;

        // We create a setup payload with unpopulated/zero `amount` for 'to'
        // TODO(#7775): Manually fetching the randomness here is not great. If we decide to include randomness in all
        // notes we could just inject it in macros.

        // Safety: We use the randomness to preserve the privacy of the note recipient by preventing brute-forcing,
        // so a malicious sender could use non-random values to make the note less private. But they already know
        // the full note pre-image anyway, and so the recipient already trusts them to not disclose this
        // information. We can therefore assume that the sender will cooperate in the random value generation.
        let note_randomness = unsafe { random() };
        let note_setup_payload = UintNote::setup_payload().new(to, note_randomness, to_note_slot);

        // We get the keys and encrypt the log of the note
        let setup_log = note_setup_payload.encrypt_log(context, to, from);

        // Using the x-coordinate as a hiding point slot is safe against someone else interfering with it because
        // we have a guarantee that the public functions of the transaction are executed right after the private ones
        // and for this reason the protocol guarantees that nobody can front-run us in consuming the hiding point.
        // This guarantee would break if `finalize_transfer_to_private` was not called in the same transaction. This
        // however is not the flow we are currently concerned with. To support the multi-transaction flow we could
        // introduce a `from` function argument, hash the x-coordinate with it and then repeat the hashing in
        // `finalize_transfer_to_private`.
        //
        // We can also be sure that the `hiding_point_slot` will not overwrite any other value in the storage because
        // in our state variables we derive slots using a different hash function from multi scalar multiplication
        // (MSM).
        let hiding_point_slot = note_setup_payload.hiding_point.x;

        // We don't need to perform a check that the value overwritten by `_store_point_in_transient_storage_unsafe`
        // is zero because the slot is the x-coordinate of the hiding point and hence we could only overwrite
        // the value in the slot with the same value. This makes usage of the `unsafe` method safe.
        Token::at(context.this_address())
            ._store_payload_in_transient_storage_unsafe(
                hiding_point_slot,
                note_setup_payload.hiding_point,
                setup_log,
            )
            .enqueue(context);

        hiding_point_slot
    }

    /// Finalizes a transfer of token `amount` from public balance of `from` to a private balance of `to`.
    /// The transfer must be prepared by calling `prepare_private_balance_increase` first and the resulting
    /// `hiding_point_slot` must be passed as an argument to this function.
    #[public]
    fn finalize_transfer_public_to_private(amount: u128, hiding_point_slot: Field) {
        let from = context.msg_sender();
        _finalize_transfer_public_to_private(
            from,
            amount,
            hiding_point_slot,
            &mut context,
            storage,
        );
    }

    #[public]
    #[internal]
    fn _finalize_transfer_public_to_private_unsafe(
        from: AztecAddress,
        amount: u128,
        hiding_point_slot: Field,
    ) {
        _finalize_transfer_public_to_private(
            from,
            amount,
            hiding_point_slot,
            &mut context,
            storage,
        );
    }

    #[contract_library_method]
    fn _finalize_transfer_public_to_private(
        from: AztecAddress,
        amount: u128,
        hiding_point_slot: Field,
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
    ) {
        // First we subtract the `amount` from the public balance of `from`
        let from_balance = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance);
        // Increase the shielded supply by the `amount`
        storage.shielded_supply.write(storage.shielded_supply.read().add(amount));

        // Then we finalize the partial note with the `amount`
        let finalization_payload =
            UintNote::finalization_payload().new(context, hiding_point_slot, amount);

        // At last we emit the note hash and the final log
        finalization_payload.emit();
    }

    /// Mints token `amount` to a private balance of `to`. Message sender has to have minter permissions (checked
    /// in the enqueud call).
    #[private]
    fn mint_shielded(to: AztecAddress, amount: u128) {
        let token = Token::at(context.this_address());

        // We prepare the partial note to which we'll "send" the minted amount.
        let hiding_point_slot =
            _prepare_private_balance_increase(context.msg_sender(), to, &mut context, storage);

        // At last we finalize the mint. Usage of the `unsafe` method here is safe because we set the `from`
        // function argument to a message sender, guaranteeing that only a message sender with minter permissions
        // can successfully execute the function.
        token
            ._finalize_mint_shielded_unsafe(context.msg_sender(), to, amount, hiding_point_slot)
            .enqueue(&mut context);
    }

    /// Finalizes a mint of token `amount` to a private balance of `to`. The mint must be prepared by calling
    /// `prepare_private_balance_increase` first and the resulting
    /// `hiding_point_slot` must be passed as an argument to this function.
    ///
    /// Note: This function is only an optimization as it could be replaced by a combination of `mint_public`
    /// and `finalize_transfer_public_to_private`. It is however used very commonly so it makes sense to optimize it
    /// (e.g. used during token bridging, in AMM liquidity token etc.).
    #[public]
    fn finalize_mint_shielded(to: AztecAddress, amount: u128, hiding_point_slot: Field) {
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");
        _finalize_mint_shielded(to, amount, hiding_point_slot, &mut context, storage);
    }

    #[public]
    #[internal]
    fn _finalize_mint_shielded_unsafe(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        hiding_point_slot: Field,
    ) {
        // We check the minter permissions as it was not done in `mint_shielded` function.
        assert(storage.minter.read().eq(from), "caller is not minter");
        _finalize_mint_shielded(to, amount, hiding_point_slot, &mut context, storage);
    }

    #[contract_library_method]
    fn _finalize_mint_shielded(
        to: AztecAddress,
        amount: u128,
        hiding_point_slot: Field,
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
    ) {
        // Increase the total supply by the `amount`
        storage.total_supply.write(storage.total_supply.read().add(amount));
        // Increase the shielded supply by the `amount`
        storage.shielded_supply.write(storage.shielded_supply.read().add(amount));

        // Finalize the partial note with the `amount`
        let finalization_payload =
            UintNote::finalization_payload().new(context, hiding_point_slot, amount);

        // emit the note hash and the final log
        finalization_payload.emit();

        // Emit the mint event
        Mint { to, amount: amount }.emit(encode_event(context));
    }

    #[contract_library_method]
    fn get_shield_gateway(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
    ) -> AztecAddress {
        Beacon::at(storage.shield_gateway_beacon.read())
            .get_target_private(context.this_address())
            .view(context)
    }

    unconstrained fn get_shield_gateway_beacon_unconstrained() -> AztecAddress {
        storage.shield_gateway_beacon.read()
    }

    #[public]
    #[view]
    fn get_shield_gateway_beacon_public() -> AztecAddress {
        storage.shield_gateway_beacon.read()
    }

    #[public]
    #[view]
    fn get_shield_gateway_public() -> AztecAddress {
        Beacon::at(storage.shield_gateway_beacon.read())
            .get_target_public(context.this_address())
            .view(&mut context)
    }

    #[private]
    #[view]
    fn get_shield_gateway_private() -> AztecAddress {
        get_shield_gateway(&mut context, storage)
    }

    #[private]
    #[view]
    fn get_shield_gateway_beacon_private() -> AztecAddress {
        storage.shield_gateway_beacon.read()
    }

    #[private]
    fn setup_refund(
        fee_payer: AztecAddress, // Address of the entity which will receive the fee note.
        user: AztecAddress, // A user for which we are setting up the fee refund.
        funded_amount: u128, // The amount the user funded the fee payer with (represents fee limit).
        nonce: Field, // A nonce to make authwitness unique.
    ) {
        // 1. This function is called by fee paying contract (fee_payer) when setting up a refund so we need to support
        // the authwit flow here and check that the user really permitted fee_payer to set up a refund on their behalf.
        assert_current_call_valid_authwit(&mut context, user);

        // 2. Deduct the funded amount from the user's balance - this is a maximum fee a user is willing to pay
        // (called fee limit in aztec spec). The difference between fee limit and the actual tx fee will be refunded
        // to the user in the `complete_refund(...)` function.
        let change = subtract_balance(
            &mut context,
            storage,
            user,
            funded_amount,
            INITIAL_TRANSFER_CALL_MAX_NOTES,
        );
        storage.private_balances.at(user).add(user, change).emit(encode_and_encrypt_note(
            &mut context,
            user,
            user,
        ));

        // 4. We prepare the partial notes
        // TODO(#9887): In each `_prepare_private_balance_increase` call we fetch the user's ovpk_m 2 more times. This is
        // very inefficient.
        let fee_payer_point_slot =
            _prepare_private_balance_increase(user, fee_payer, &mut context, storage);
        let user_point_slot = _prepare_private_balance_increase(user, user, &mut context, storage);

        // 5. Set the public teardown function to `complete_refund(...)`. Public teardown is the only time when a public
        // function has access to the final transaction fee, which is needed to compute the actual refund amount.
        context.set_public_teardown_function(
            context.this_address(),
            comptime { FunctionSelector::from_signature("complete_refund(Field,Field,Field)") },
            [fee_payer_point_slot, user_point_slot, funded_amount.to_field()],
        );
    }

    // TODO(#9375): Having to define the note log length here is very unfortunate as it's basically impossible for
    // users to derive manually. This will however go away once we have a real transient storage since we will not need
    // the public call and instead we would do something like `context.transient_storage_write(slot, payload)` and that
    // will allow us to use generics and hence user will not need to define it explicitly. We cannot use generics here
    // as it is an entrypoint function.
    #[public]
    #[internal]
    fn _store_payload_in_transient_storage_unsafe(
        slot: Field,
        point: Point,
        setup_log: [Field; 9],
    ) {
        context.storage_write(slot, point);
        context.storage_write(slot + aztec::protocol_types::point::POINT_LENGTH as Field, setup_log);
    }

    /// Internal ///

    #[public]
    #[internal]
    fn _increase_public_balance(to: AztecAddress, amount: u128) {
        let new_balance = storage.public_balances.at(to).read().add(amount);
        storage.public_balances.at(to).write(new_balance);

        // Decrease the shielded supply by the `amount`
        let new_shielded_supply = storage.shielded_supply.read().sub(amount);
        storage.shielded_supply.write(new_shielded_supply);

        // Emit the transfer event
        Transfer { to, amount }.emit(encode_event(&mut context));
    }

    #[public]
    #[internal]
    fn _reduce_total_supply(amount: u128) {
        // Only to be called from burn.
        let new_supply = storage.total_supply.read().sub(amount);
        storage.total_supply.write(new_supply);

        // Decrease the shielded supply by the `amount`
        let new_shielded_supply = storage.shielded_supply.read().sub(amount);
        storage.shielded_supply.write(new_shielded_supply);
    }

    #[public]
    #[internal]
    fn _log_shield(from: AztecAddress, amount: u128) {
        Shield { from, amount: amount }.emit(encode_event(&mut context));
    }

    #[public]
    #[internal]
    fn _log_unshield(from: AztecAddress, amount: u128) {
        Unshield { from, amount: amount }.emit(encode_event(&mut context));
    }

    /// Unconstrained ///

    pub(crate) unconstrained fn balance_of_private(owner: AztecAddress) -> pub u128{
        storage.private_balances.at(owner).balance_of()
    }
}
