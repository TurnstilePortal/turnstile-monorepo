mod types;

use dep::aztec::macros::aztec;

// Minimal token implementation that supports `AuthWit` accounts.
// The auth message follows a similar pattern to the cross-chain message and includes a designated caller.
// The designated caller is ALWAYS used here, and not based on a flag as cross-chain.
// message hash = H([caller, contract, selector, ...args])
// To be read as `caller` calls function at `contract` defined by `selector` with `args`
// Including a nonce in the message hash ensures that the message can only be used once.
#[aztec]
pub contract Token {
    // Libs
    use std::{meta::derive, ops::{Add, Sub}};

    use dep::compressed_string::FieldCompressedString;

    use dep::aztec::{
        context::{PrivateCallInterface, PrivateContext},
        event::event_interface::EventInterface,
        macros::{
            events::event,
            functions::{initializer, internal, private, public, utility, view},
            storage::storage,
        },
        messages::logs::{
            event::encode_and_encrypt_event_unconstrained,
            note::{encode_and_encrypt_note, encode_and_encrypt_note_unconstrained},
        },
        prelude::{AztecAddress, Map, PublicContext, PublicImmutable, PublicMutable},
        protocol_types::traits::{
            Serialize,
            ToField,
        },
        unencrypted_logs::unencrypted_event_emission::encode_event,
    };

    use dep::uint_note::uint_note::{PartialUintNote, UintNote};

    use dep::authwit::auth::{
        assert_current_call_valid_authwit, assert_current_call_valid_authwit_public,
        compute_authwit_nullifier,
    };

    use shield_gateway::ShieldGateway;

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
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
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
    struct Mint {
        to: AztecAddress,
        amount: u128,
    }

    #[storage]
    struct Storage<Context> {
        minter: PublicImmutable<AztecAddress, Context>,
        shield_gateway: PublicImmutable<AztecAddress, Context>,
        balances: Map<AztecAddress, BalanceSet<Context>, Context>,
        public_balances: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

        total_supply: PublicMutable<u128, Context>,
        shielded_supply: PublicMutable<u128, Context>,

        symbol: PublicImmutable<FieldCompressedString, Context>,
        name: PublicImmutable<FieldCompressedString, Context>,
        decimals: PublicImmutable<u8, Context>,
    }

    #[public]
    #[initializer]
    fn init(minter: AztecAddress, name: str<31>, symbol: str<31>, decimals: u8) {
        assert(!minter.is_zero(), "invalid minter");
        assert(name.as_bytes().len() > 0, "Name cannot be empty");
        assert(symbol.as_bytes().len() > 0, "Symbol cannot be empty");

        aztec::oracle::debug_log::debug_log("Initializing token...");
        aztec::oracle::debug_log::debug_log_format("Minter: {0}", [minter.to_field()]);
        aztec::oracle::debug_log::debug_log_format("Name: {0}", [name.to_field()]);
        aztec::oracle::debug_log::debug_log_format("Symbol: {0}", [symbol.to_field()]);
        aztec::oracle::debug_log::debug_log_format("Decimals: {0}", [decimals.to_field()]);

        storage.minter.initialize(minter);
        storage.name.initialize(FieldCompressedString::from_string(name));
        storage.symbol.initialize(FieldCompressedString::from_string(symbol));
        storage.decimals.initialize(decimals);
    }

    #[utility]
    pub unconstrained fn get_portal() -> AztecAddress {
        storage.minter.read()
    }

    #[public]
    fn set_shield_gateway(shield_gateway: AztecAddress) {
        aztec::oracle::debug_log::debug_log_format("Setting shield gateway to {0}", [shield_gateway.to_field()]);
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");
        storage.shield_gateway.initialize(shield_gateway);
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
    fn is_minter(minter: AztecAddress) -> bool {
        storage.minter.read().eq(minter)
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
    fn mint_to_public(to: AztecAddress, amount: u128) {
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");

        let new_balance = storage.public_balances.at(to).read().add(amount);
        let supply = storage.total_supply.read().add(amount);
        storage.public_balances.at(to).write(new_balance);
        storage.total_supply.write(supply);

        // Emit the mint event
        Mint { to, amount: amount }.emit(encode_event(&mut context));
    }

    /// Mints token `amount` to a private balance of `to`. Message sender has to have minter permissions (checked
    /// in the enqueud call).
    #[private]
    fn mint_shielded(to: AztecAddress, amount: u128) {
        let token = Token::at(context.this_address());

        // We prepare the partial note to which we'll "send" the minted amount.
        let partial_note =
            _prepare_private_balance_increase(context.msg_sender(), to, &mut context, storage);

        // At last we finalize the mint. Usage of the `unsafe` method here is safe because we set the `from`
        // function argument to a message sender, guaranteeing that only a message sender with minter permissions
        // can successfully execute the function.
        token
            ._finalize_mint_shielded_unsafe(
                context.msg_sender(),
                context.msg_sender(),
                amount,
                partial_note,
            )
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
    fn finalize_mint_shielded(to: AztecAddress, amount: u128, partial_note: PartialUintNote) {
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");
        _finalize_mint_shielded(to, amount, partial_note, &mut context, storage);
    }

    #[public]
    #[internal]
    fn _finalize_mint_shielded_unsafe(
        to: AztecAddress,
        from: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
    ) {
        // We check the minter permissions as it was not done in `mint_shielded` function.
        assert(storage.minter.read().eq(from), "caller is not minter");
        _finalize_mint_shielded(to, amount, partial_note, &mut context, storage);
    }

    #[contract_library_method]
    fn _finalize_mint_shielded(
        to_and_completer: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
    ) {
        // Increase the total supply by the `amount`
        storage.total_supply.write(storage.total_supply.read().add(amount));
        // Increase the shielded supply by the `amount`
        storage.shielded_supply.write(storage.shielded_supply.read().add(amount));

        partial_note.complete(context, to_and_completer, amount);

        // Emit the mint event
        Mint { to: to_and_completer, amount: amount }.emit(encode_event(context));
    }

    #[public]
    fn transfer_in_public(from: AztecAddress, to: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        let from_balance = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance);
        let to_balance = storage.public_balances.at(to).read().add(amount);
        storage.public_balances.at(to).write(to_balance);
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
    }

    #[private]
    fn transfer_to_public(from: AztecAddress, to: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        assert_shield_gateway_permitted(&mut context, storage, from, to, amount);

        storage.balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));
        Token::at(context.this_address())._increase_public_balance(to, amount).enqueue(&mut context);
    }

    #[private]
    fn transfer(to: AztecAddress, amount: u128) {
        let from = context.msg_sender();

        // We reduce `from`'s balance by amount by recursively removing notes over potentially multiple calls. This
        // method keeps the gate count for each individual call low - reading too many notes at once could result in
        // circuits in which proving is not feasible.
        // Since the sum of the amounts in the notes we nullified was potentially larger than amount, we create a new
        // note for `from` with the change amount, e.g. if `amount` is 10 and two notes are nullified with amounts 8 and
        // 5, then the change will be 3 (since 8 + 5 - 10 = 3).
        let change = subtract_balance(
            &mut context,
            storage,
            from,
            amount,
            INITIAL_TRANSFER_CALL_MAX_NOTES,
        );
        storage.balances.at(from).add(from, change).emit(encode_and_encrypt_note_unconstrained(
            &mut context,
            from,
            from,
        ));
        storage.balances.at(to).add(to, amount).emit(encode_and_encrypt_note_unconstrained(
            &mut context,
            to,
            from,
        ));

        // We don't constrain encryption of the note log in `transfer` (unlike in `transfer_in_private`) because the transfer
        // function is only designed to be used in situations where the event is not strictly necessary (e.g. payment to
        // another person where the payment is considered to be successful when the other party successfully decrypts a
        // note).

        Transfer { from, to, amount }.emit(encode_and_encrypt_event_unconstrained(
            &mut context,
            to,
            from,
        ));
    }

    #[contract_library_method]
    fn subtract_balance(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        account: AztecAddress,
        amount: u128,
        max_notes: u32,
    ) -> u128 {
        let subtracted = storage.balances.at(account).try_sub(amount, max_notes);
        // Failing to subtract any amount means that the owner was unable to produce more notes that could be nullified.
        // We could in some cases fail early inside try_sub if we detected that fewer notes than the maximum were
        // returned and we were still unable to reach the target amount, but that'd make the code more complicated, and
        // optimizing for the failure scenario is not as important.
        assert(subtracted > 0 as u128, "Balance too low");
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
    fn transfer_in_private(from: AztecAddress, to: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        // Ensure that the transfer is permitted by the shield gateway
        assert_shield_gateway_permitted(&mut context, storage, from, to, amount);

        storage.balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));

        storage.balances.at(to).add(to, amount).emit(encode_and_encrypt_note(&mut context, to, from));
    }

    #[private]
    fn burn_private(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        storage.balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
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

        Token::at(context.this_address())._transfer_to_private(from, from, amount).call(&mut context);

        Token::at(context.this_address())._log_shield(from, amount).enqueue(&mut context);
    }

    #[private]
    fn unshield(from: AztecAddress, amount: u128, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        storage.balances.at(from).sub(from, amount).emit(encode_and_encrypt_note(
            &mut context,
            from,
            from,
        ));
        Token::at(context.this_address())._increase_public_balance(from, amount).enqueue(
            &mut context,
        );
        Token::at(context.this_address())._log_unshield(from, amount).enqueue(&mut context);
    }

    #[private]
    #[internal]
    fn _transfer_to_private(from: AztecAddress, to: AztecAddress, amount: u128) {
        let token = Token::at(context.this_address());
        let partial_note = _prepare_private_balance_increase(from, to, &mut context, storage);
        token._finalize_transfer_to_private_unsafe(from, amount, partial_note).enqueue(&mut context);
    }

    // Transfers token `amount` from public balance of message sender to a private balance of `to`.
    #[private]
    fn transfer_to_private(to: AztecAddress, amount: u128) {
        // `from` is the owner of the public balance from which we'll subtract the `amount`.
        let from = context.msg_sender();
        let token = Token::at(context.this_address());

        // Ensure that the transfer is permitted by the shield gateway
        assert_shield_gateway_permitted(&mut context, storage, from, to, amount);

        // We prepare the private balance increase (the partial note).
        let partial_note = _prepare_private_balance_increase(from, to, &mut context, storage);

        // At last we finalize the transfer. Usage of the `unsafe` method here is safe because we set the `from`
        // function argument to a message sender, guaranteeing that he can transfer only his own tokens.
        token._finalize_transfer_to_private_unsafe(from, amount, partial_note).enqueue(&mut context);
    }

    /// Prepares an increase of private balance of `to` (partial note). The increase needs to be finalized by calling
    /// some of the finalization functions (`finalize_transfer_to_private`, `finalize_mint_to_private`) with the
    /// returned partial note.
    #[private]
    fn prepare_private_balance_increase(to: AztecAddress, from: AztecAddress) -> PartialUintNote {
        // ideally we'd not have `from` here, but we do need a `from` address to produce a tagging secret with `to`.
        _prepare_private_balance_increase(from, to, &mut context, storage)
    }

    /// This function exists separately from `prepare_private_balance_increase` solely as an optimization as it allows
    /// us to have it inlined in the `transfer_to_private` function which results in one fewer kernel iteration.
    ///
    /// TODO(#9180): Consider adding macro support for functions callable both as an entrypoint and as an internal
    /// function.
    #[contract_library_method]
    fn _prepare_private_balance_increase(
        from: AztecAddress, // sender of the tag
        to: AztecAddress,
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
    ) -> PartialUintNote {
        let partial_note = UintNote::partial(
            to,
            storage.balances.at(to).set.storage_slot,
            context,
            to,
            from,
            context.msg_sender(),
        );

        partial_note
    }

    /// Finalizes a transfer of token `amount` from public balance of `from` to a private balance of `to`.
    /// The transfer must be prepared by calling `prepare_private_balance_increase` first and the resulting
    /// `partial_note` must be passed as an argument to this function.
    #[public]
    fn finalize_transfer_to_private(amount: u128, partial_note: PartialUintNote) {
        let from_and_completer = context.msg_sender();
        _finalize_transfer_to_private(from_and_completer, amount, partial_note, &mut context, storage);
    }

    /// This is a wrapper around `_finalize_transfer_to_private` placed here so that a call
    /// to `_finalize_transfer_to_private` can be enqueued. Called unsafe as it does not check `from` (this has to be
    /// done in the calling function).
    #[public]
    #[internal]
    fn _finalize_transfer_to_private_unsafe(
        from: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
    ) {
        _finalize_transfer_to_private(from, amount, partial_note, &mut context, storage);
    }

    #[contract_library_method]
    fn _finalize_transfer_to_private(
        from_and_completer: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
    ) {
        // First we subtract the `amount` from the public balance of `from`
        let from_balance = storage.public_balances.at(from_and_completer).read().sub(amount);
        storage.public_balances.at(from_and_completer).write(from_balance);

        partial_note.complete(context, from_and_completer, amount);
    }

    /// Mints token `amount` to a private balance of `to`. Message sender has to have minter permissions (checked
    /// in the enqueued call).
    #[private]
    fn mint_to_private(
        from: AztecAddress, // sender of the tag
        to: AztecAddress,
        amount: u128,
    ) {
        let token = Token::at(context.this_address());

        // We prepare the partial note to which we'll "send" the minted amount.
        let partial_note = _prepare_private_balance_increase(from, to, &mut context, storage);

        // At last we finalize the mint. Usage of the `unsafe` method here is safe because we set the `from`
        // function argument to a message sender, guaranteeing that only a message sender with minter permissions
        // can successfully execute the function.
        token._finalize_mint_to_private_unsafe(context.msg_sender(), amount, partial_note).enqueue(
            &mut context,
        );
    }

    /// Finalizes a mint of token `amount` to a private balance of `to`. The mint must be prepared by calling
    /// `prepare_private_balance_increase` first and the resulting
    /// `partial_note` must be passed as an argument to this function.
    ///
    /// Note: This function is only an optimization as it could be replaced by a combination of `mint_to_public`
    /// and `finalize_transfer_to_private`. It is however used very commonly so it makes sense to optimize it
    /// (e.g. used during token bridging, in AMM liquidity token etc.).
    #[public]
    fn finalize_mint_to_private(amount: u128, partial_note: PartialUintNote) {
        let minter_and_completer = context.msg_sender();
        assert(storage.minter.read().eq(minter_and_completer), "caller is not minter");

        _finalize_mint_to_private(minter_and_completer, amount, partial_note, &mut context, storage);
    }

    #[public]
    #[internal]
    fn _finalize_mint_to_private_unsafe(
        minter_and_completer: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
    ) {
        // We check the minter permissions as it was not done in `mint_to_private` function.
        assert(storage.minter.read().eq(context.msg_sender()), "caller is not minter");
        _finalize_mint_to_private(minter_and_completer, amount, partial_note, &mut context, storage);
    }

    #[contract_library_method]
    fn _finalize_mint_to_private(
        minter_and_completer: AztecAddress,
        amount: u128,
        partial_note: PartialUintNote,
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
    ) {
        // First we increase the total supply by the `amount`
        let supply = storage.total_supply.read().add(amount);
        storage.total_supply.write(supply);

        partial_note.complete(context, minter_and_completer, amount);
    }

    /// Internal ///

    /// TODO(#9180): Consider adding macro support for functions callable both as an entrypoint and as an internal
    /// function.
    #[public]
    #[internal]
    fn _increase_public_balance(to: AztecAddress, amount: u128) {
        _increase_public_balance_inner(to, amount, storage);
    }

    #[contract_library_method]
    fn _increase_public_balance_inner(
        to: AztecAddress,
        amount: u128,
        storage: Storage<&mut PublicContext>,
    ) {
        let new_balance = storage.public_balances.at(to).read().add(amount);
        storage.public_balances.at(to).write(new_balance);
    }

    #[contract_library_method]
    fn assert_shield_gateway_permitted(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        sender: AztecAddress,
        recipient: AztecAddress,
        amount: u128,
    ) {
        ShieldGateway::at(storage.shield_gateway.read())
            .check_transfer(sender, recipient, amount)
            .call(context);
    }

    #[public]
    #[view]
    fn get_shield_gateway_public() -> AztecAddress {
        storage.shield_gateway.read()
    }

    #[private]
    #[view]
    fn get_shield_gateway_private() -> AztecAddress {
        storage.shield_gateway.read()
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

    #[public]
    #[internal]
    fn _reduce_total_supply(amount: u128) {
        // Only to be called from burn.
        let new_supply = storage.total_supply.read().sub(amount);
        storage.total_supply.write(new_supply);
    }

    #[utility]
    pub(crate) unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        storage.balances.at(owner).balance_of()
    }

    #[utility]
    pub unconstrained fn get_shield_gateway_unconstrained() -> AztecAddress {
        storage.shield_gateway.read()
    }
}
