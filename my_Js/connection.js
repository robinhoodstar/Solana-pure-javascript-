class Connection {
    constructor(e, t) {
        let r, s, n, o, a, i;
        this._commitment = void 0,
        this._confirmTransactionInitialTimeout = void 0,
        this._rpcEndpoint = void 0,
        this._rpcWsEndpoint = void 0,
        this._rpcClient = void 0,
        this._rpcRequest = void 0,
        this._rpcBatchRequest = void 0,
        this._rpcWebSocket = void 0,
        this._rpcWebSocketConnected = !1,
        this._rpcWebSocketHeartbeat = null,
        this._rpcWebSocketIdleTimeout = null,
        this._rpcWebSocketGeneration = 0,
        this._disableBlockhashCaching = !1,
        this._pollingBlockhash = !1,
        this._blockhashInfo = {
            latestBlockhash: null,
            lastFetch: 0,
            transactionSignatures: [],
            simulatedSignatures: []
        },
        this._nextClientSubscriptionId = 0,
        this._subscriptionDisposeFunctionsByClientSubscriptionId = {},
        this._subscriptionHashByClientSubscriptionId = {},
        this._subscriptionStateChangeCallbacksByHash = {},
        this._subscriptionCallbacksByServerSubscriptionId = {},
        this._subscriptionsByHash = {},
        this._subscriptionsAutoDisposedByRpc = new Set,
        this.getBlockHeight = ( () => {
            const e = {};
            return async t => {
                const {commitment: r, config: s} = extractCommitmentFromConfig(t)
                  , n = this._buildArgs([], r, void 0, s)
                  , o = fastStableStringify(n);
                return e[o] = e[o] ?? (async () => {
                    try {
                        const e = await this._rpcRequest("getBlockHeight", n)
                          , t = superstruct.create(e, jsonRpcResult(superstruct.number()));
                        if ("error"in t)
                            throw new SolanaJSONRPCError(t.error,"failed to get block height information");
                        return t.result
                    } finally {
                        delete e[o]
                    }
                }
                )(),
                await e[o]
            }
        }
        )(),
        t && "string" == typeof t ? this._commitment = t : t && (this._commitment = t.commitment,
        this._confirmTransactionInitialTimeout = t.confirmTransactionInitialTimeout,
        r = t.wsEndpoint,
        s = t.httpHeaders,
        n = t.fetch,
        o = t.fetchMiddleware,
        a = t.disableRetryOnRateLimit,
        i = t.httpAgent),
        this._rpcEndpoint = assertEndpointUrl(e),
        this._rpcWsEndpoint = r || makeWebsocketUrl(e),
        this._rpcClient = createRpcClient(e, s, n, o, a, i),
        this._rpcRequest = createRpcRequest(this._rpcClient),
        this._rpcBatchRequest = createRpcBatchRequest(this._rpcClient),
        this._rpcWebSocket = new RpcWebSocketClient(this._rpcWsEndpoint,{
            autoconnect: !1,
            max_reconnects: 1 / 0
        }),
        this._rpcWebSocket.on("open", this._wsOnOpen.bind(this)),
        this._rpcWebSocket.on("error", this._wsOnError.bind(this)),
        this._rpcWebSocket.on("close", this._wsOnClose.bind(this)),
        this._rpcWebSocket.on("accountNotification", this._wsOnAccountNotification.bind(this)),
        this._rpcWebSocket.on("programNotification", this._wsOnProgramAccountNotification.bind(this)),
        this._rpcWebSocket.on("slotNotification", this._wsOnSlotNotification.bind(this)),
        this._rpcWebSocket.on("slotsUpdatesNotification", this._wsOnSlotUpdatesNotification.bind(this)),
        this._rpcWebSocket.on("signatureNotification", this._wsOnSignatureNotification.bind(this)),
        this._rpcWebSocket.on("rootNotification", this._wsOnRootNotification.bind(this)),
        this._rpcWebSocket.on("logsNotification", this._wsOnLogsNotification.bind(this))
    }
    get commitment() {
        return this._commitment
    }
    get rpcEndpoint() {
        return this._rpcEndpoint
    }
    async getBalanceAndContext(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgs([e.toBase58()], r, void 0, s)
          , o = await this._rpcRequest("getBalance", n)
          , a = superstruct.create(o, jsonRpcResultAndContext(superstruct.number()));
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,`failed to get balance for ${e.toBase58()}`);
        return a.result
    }
    async getBalance(e, t) {
        return await this.getBalanceAndContext(e, t).then((e => e.value)).catch((t => {
            throw new Error("failed to get balance of account " + e.toBase58() + ": " + t)
        }
        ))
    }
    async getBlockTime(e) {
        const t = await this._rpcRequest("getBlockTime", [e])
          , r = superstruct.create(t, jsonRpcResult(superstruct.nullable(superstruct.number())));
        if ("error"in r)
            throw new SolanaJSONRPCError(r.error,`failed to get block time for slot ${e}`);
        return r.result
    }
    async getMinimumLedgerSlot() {
        const e = await this._rpcRequest("minimumLedgerSlot", [])
          , t = superstruct.create(e, jsonRpcResult(superstruct.number()));
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get minimum ledger slot");
        return t.result
    }
    async getFirstAvailableBlock() {
        const e = await this._rpcRequest("getFirstAvailableBlock", [])
          , t = superstruct.create(e, SlotRpcResult);
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get first available block");
        return t.result
    }
    async getSupply(e) {
        let t = {};
        t = "string" == typeof e ? {
            commitment: e
        } : e ? {
            ...e,
            commitment: e && e.commitment || this.commitment
        } : {
            commitment: this.commitment
        };
        const r = await this._rpcRequest("getSupply", [t])
          , s = superstruct.create(r, GetSupplyRpcResult);
        if ("error"in s)
            throw new SolanaJSONRPCError(s.error,"failed to get supply");
        return s.result
    }
    async getTokenSupply(e, t) {
        const r = this._buildArgs([e.toBase58()], t)
          , s = await this._rpcRequest("getTokenSupply", r)
          , n = superstruct.create(s, jsonRpcResultAndContext(TokenAmountResult));
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get token supply");
        return n.result
    }
    async getTokenAccountBalance(e, t) {
        const r = this._buildArgs([e.toBase58()], t)
          , s = await this._rpcRequest("getTokenAccountBalance", r)
          , n = superstruct.create(s, jsonRpcResultAndContext(TokenAmountResult));
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get token account balance");
        return n.result
    }
    async getTokenAccountsByOwner(e, t, r) {
        const {commitment: s, config: n} = extractCommitmentFromConfig(r);
        let o = [e.toBase58()];
        "mint"in t ? o.push({
            mint: t.mint.toBase58()
        }) : o.push({
            programId: t.programId.toBase58()
        });
        const a = this._buildArgs(o, s, "base64", n)
          , i = await this._rpcRequest("getTokenAccountsByOwner", a)
          , u = superstruct.create(i, GetTokenAccountsByOwner);
        if ("error"in u)
            throw new SolanaJSONRPCError(u.error,`failed to get token accounts owned by account ${e.toBase58()}`);
        return u.result
    }
    async getParsedTokenAccountsByOwner(e, t, r) {
        let s = [e.toBase58()];
        "mint"in t ? s.push({
            mint: t.mint.toBase58()
        }) : s.push({
            programId: t.programId.toBase58()
        });
        const n = this._buildArgs(s, r, "jsonParsed")
          , o = await this._rpcRequest("getTokenAccountsByOwner", n)
          , a = superstruct.create(o, GetParsedTokenAccountsByOwner);
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,`failed to get token accounts owned by account ${e.toBase58()}`);
        return a.result
    }
    async getLargestAccounts(e) {
        const t = {
            ...e,
            commitment: e && e.commitment || this.commitment
        }
          , r = t.filter || t.commitment ? [t] : []
          , s = await this._rpcRequest("getLargestAccounts", r)
          , n = superstruct.create(s, GetLargestAccountsRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get largest accounts");
        return n.result
    }
    async getTokenLargestAccounts(e, t) {
        const r = this._buildArgs([e.toBase58()], t)
          , s = await this._rpcRequest("getTokenLargestAccounts", r)
          , n = superstruct.create(s, GetTokenLargestAccountsResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get token largest accounts");
        return n.result
    }
    async getAccountInfoAndContext(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgs([e.toBase58()], r, "base64", s)
          , o = await this._rpcRequest("getAccountInfo", n)
          , a = superstruct.create(o, jsonRpcResultAndContext(superstruct.nullable(AccountInfoResult)));
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,`failed to get info about account ${e.toBase58()}`);
        return a.result
    }
    async getParsedAccountInfo(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgs([e.toBase58()], r, "jsonParsed", s)
          , o = await this._rpcRequest("getAccountInfo", n)
          , a = superstruct.create(o, jsonRpcResultAndContext(superstruct.nullable(ParsedAccountInfoResult)));
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,`failed to get info about account ${e.toBase58()}`);
        return a.result
    }
    async getAccountInfo(e, t) {
        try {
            return (await this.getAccountInfoAndContext(e, t)).value
        } catch (t) {
            throw new Error("failed to get info about account " + e.toBase58() + ": " + t)
        }
    }
    async getMultipleParsedAccounts(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = e.map((e => e.toBase58()))
          , o = this._buildArgs([n], r, "jsonParsed", s)
          , a = await this._rpcRequest("getMultipleAccounts", o)
          , i = superstruct.create(a, jsonRpcResultAndContext(superstruct.array(superstruct.nullable(ParsedAccountInfoResult))));
        if ("error"in i)
            throw new SolanaJSONRPCError(i.error,`failed to get info for accounts ${n}`);
        return i.result
    }
    async getMultipleAccountsInfoAndContext(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = e.map((e => e.toBase58()))
          , o = this._buildArgs([n], r, "base64", s)
          , a = await this._rpcRequest("getMultipleAccounts", o)
          , i = superstruct.create(a, jsonRpcResultAndContext(superstruct.array(superstruct.nullable(AccountInfoResult))));
        if ("error"in i)
            throw new SolanaJSONRPCError(i.error,`failed to get info for accounts ${n}`);
        return i.result
    }
    async getMultipleAccountsInfo(e, t) {
        return (await this.getMultipleAccountsInfoAndContext(e, t)).value
    }
    async getStakeActivation(e, t, r) {
        const {commitment: s, config: n} = extractCommitmentFromConfig(t)
          , o = this._buildArgs([e.toBase58()], s, void 0, {
            ...n,
            epoch: null != r ? r : n?.epoch
        })
          , a = await this._rpcRequest("getStakeActivation", o)
          , i = superstruct.create(a, jsonRpcResult(StakeActivationResult));
        if ("error"in i)
            throw new SolanaJSONRPCError(i.error,`failed to get Stake Activation ${e.toBase58()}`);
        return i.result
    }
    async getProgramAccounts(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , {encoding: n, ...o} = s || {}
          , a = this._buildArgs([e.toBase58()], r, n || "base64", {
            ...o,
            ...o.filters ? {
                filters: applyDefaultMemcmpEncodingToFilters(o.filters)
            } : null
        })
          , i = await this._rpcRequest("getProgramAccounts", a)
          , u = superstruct.array(KeyedAccountInfoResult)
          , c = !0 === o.withContext ? superstruct.create(i, jsonRpcResultAndContext(u)) : superstruct.create(i, jsonRpcResult(u));
        if ("error"in c)
            throw new SolanaJSONRPCError(c.error,`failed to get accounts owned by program ${e.toBase58()}`);
        return c.result
    }
    async getParsedProgramAccounts(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgs([e.toBase58()], r, "jsonParsed", s)
          , o = await this._rpcRequest("getProgramAccounts", n)
          , a = superstruct.create(o, jsonRpcResult(superstruct.array(KeyedParsedAccountInfoResult)));
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,`failed to get accounts owned by program ${e.toBase58()}`);
        return a.result
    }
    async confirmTransaction(e, t) {
        let r, s;
        if ("string" == typeof e)
            r = e;
        else {
            const t = e;
            if (t.abortSignal?.aborted)
                return Promise.reject(t.abortSignal.reason);
            r = t.signature
        }
        try {
            s = bs58__default.default.decode(r)
        } catch (e) {
            throw new Error("signature must be base58 encoded: " + r)
        }
        return assert(64 === s.length, "signature has invalid length"),
        "string" == typeof e ? await this.confirmTransactionUsingLegacyTimeoutStrategy({
            commitment: t || this.commitment,
            signature: r
        }) : "lastValidBlockHeight"in e ? await this.confirmTransactionUsingBlockHeightExceedanceStrategy({
            commitment: t || this.commitment,
            strategy: e
        }) : await this.confirmTransactionUsingDurableNonceStrategy({
            commitment: t || this.commitment,
            strategy: e
        })
    }
    getCancellationPromise(e) {
        return new Promise(( (t, r) => {
            null != e && (e.aborted ? r(e.reason) : e.addEventListener("abort", ( () => {
                r(e.reason)
            }
            )))
        }
        ))
    }
    getTransactionConfirmationPromise({commitment: e, signature: t}) {
        let r, s, n = !1;
        return {
            abortConfirmation: () => {
                s && (s(),
                s = void 0),
                null != r && (this.removeSignatureListener(r),
                r = void 0)
            }
            ,
            confirmationPromise: new Promise(( (o, a) => {
                try {
                    r = this.onSignature(t, ( (e, t) => {
                        r = void 0;
                        const s = {
                            context: t,
                            value: e
                        };
                        o({
                            __type: TransactionStatus.PROCESSED,
                            response: s
                        })
                    }
                    ), e);
                    const i = new Promise((e => {
                        null == r ? e() : s = this._onSubscriptionStateChange(r, (t => {
                            "subscribed" === t && e()
                        }
                        ))
                    }
                    ));
                    (async () => {
                        if (await i,
                        n)
                            return;
                        const r = await this.getSignatureStatus(t);
                        if (n)
                            return;
                        if (null == r)
                            return;
                        const {context: s, value: u} = r;
                        if (null != u)
                            if (u?.err)
                                a(u.err);
                            else {
                                switch (e) {
                                case "confirmed":
                                case "single":
                                case "singleGossip":
                                    if ("processed" === u.confirmationStatus)
                                        return;
                                    break;
                                case "finalized":
                                case "max":
                                case "root":
                                    if ("processed" === u.confirmationStatus || "confirmed" === u.confirmationStatus)
                                        return
                                }
                                n = !0,
                                o({
                                    __type: TransactionStatus.PROCESSED,
                                    response: {
                                        context: s,
                                        value: u
                                    }
                                })
                            }
                    }
                    )()
                } catch (e) {
                    a(e)
                }
            }
            ))
        }
    }
    async confirmTransactionUsingBlockHeightExceedanceStrategy({commitment: e, strategy: {abortSignal: t, lastValidBlockHeight: r, signature: s}}) {
        let n = !1;
        const o = new Promise((t => {
            const s = async () => {
                try {
                    return await this.getBlockHeight(e)
                } catch (e) {
                    return -1
                }
            }
            ;
            (async () => {
                let e = await s();
                if (!n) {
                    for (; e <= r; ) {
                        if (await sleep(1e3),
                        n)
                            return;
                        if (e = await s(),
                        n)
                            return
                    }
                    t({
                        __type: TransactionStatus.BLOCKHEIGHT_EXCEEDED
                    })
                }
            }
            )()
        }
        ))
          , {abortConfirmation: a, confirmationPromise: i} = this.getTransactionConfirmationPromise({
            commitment: e,
            signature: s
        })
          , u = this.getCancellationPromise(t);
        let c;
        try {
            const e = await Promise.race([u, i, o]);
            if (e.__type !== TransactionStatus.PROCESSED)
                throw new TransactionExpiredBlockheightExceededError(s);
            c = e.response
        } finally {
            n = !0,
            a()
        }
        return c
    }
    async confirmTransactionUsingDurableNonceStrategy({commitment: e, strategy: {abortSignal: t, minContextSlot: r, nonceAccountPubkey: s, nonceValue: n, signature: o}}) {
        let a = !1;
        const i = new Promise((t => {
            let o = n
              , i = null;
            const u = async () => {
                try {
                    const {context: t, value: n} = await this.getNonceAndContext(s, {
                        commitment: e,
                        minContextSlot: r
                    });
                    return i = t.slot,
                    n?.nonce
                } catch (e) {
                    return o
                }
            }
            ;
            (async () => {
                if (o = await u(),
                !a)
                    for (; ; ) {
                        if (n !== o)
                            return void t({
                                __type: TransactionStatus.NONCE_INVALID,
                                slotInWhichNonceDidAdvance: i
                            });
                        if (await sleep(2e3),
                        a)
                            return;
                        if (o = await u(),
                        a)
                            return
                    }
            }
            )()
        }
        ))
          , {abortConfirmation: u, confirmationPromise: c} = this.getTransactionConfirmationPromise({
            commitment: e,
            signature: o
        })
          , l = this.getCancellationPromise(t);
        let p;
        try {
            const t = await Promise.race([l, c, i]);
            if (t.__type === TransactionStatus.PROCESSED)
                p = t.response;
            else {
                let s;
                for (; ; ) {
                    const e = await this.getSignatureStatus(o);
                    if (null == e)
                        break;
                    if (!(e.context.slot < (t.slotInWhichNonceDidAdvance ?? r))) {
                        s = e;
                        break
                    }
                    await sleep(400)
                }
                if (!s?.value)
                    throw new TransactionExpiredNonceInvalidError(o);
                {
                    const t = e || "finalized"
                      , {confirmationStatus: r} = s.value;
                    switch (t) {
                    case "processed":
                    case "recent":
                        if ("processed" !== r && "confirmed" !== r && "finalized" !== r)
                            throw new TransactionExpiredNonceInvalidError(o);
                        break;
                    case "confirmed":
                    case "single":
                    case "singleGossip":
                        if ("confirmed" !== r && "finalized" !== r)
                            throw new TransactionExpiredNonceInvalidError(o);
                        break;
                    case "finalized":
                    case "max":
                    case "root":
                        if ("finalized" !== r)
                            throw new TransactionExpiredNonceInvalidError(o)
                    }
                    p = {
                        context: s.context,
                        value: {
                            err: s.value.err
                        }
                    }
                }
            }
        } finally {
            a = !0,
            u()
        }
        return p
    }
    async confirmTransactionUsingLegacyTimeoutStrategy({commitment: e, signature: t}) {
        let r;
        const s = new Promise((t => {
            let s = this._confirmTransactionInitialTimeout || 6e4;
            switch (e) {
            case "processed":
            case "recent":
            case "single":
            case "confirmed":
            case "singleGossip":
                s = this._confirmTransactionInitialTimeout || 3e4
            }
            r = setTimeout(( () => t({
                __type: TransactionStatus.TIMED_OUT,
                timeoutMs: s
            })), s)
        }
        ))
          , {abortConfirmation: n, confirmationPromise: o} = this.getTransactionConfirmationPromise({
            commitment: e,
            signature: t
        });
        let a;
        try {
            const e = await Promise.race([o, s]);
            if (e.__type !== TransactionStatus.PROCESSED)
                throw new TransactionExpiredTimeoutError(t,e.timeoutMs / 1e3);
            a = e.response
        } finally {
            clearTimeout(r),
            n()
        }
        return a
    }
    async getClusterNodes() {
        const e = await this._rpcRequest("getClusterNodes", [])
          , t = superstruct.create(e, jsonRpcResult(superstruct.array(ContactInfoResult)));
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get cluster nodes");
        return t.result
    }
    async getVoteAccounts(e) {
        const t = this._buildArgs([], e)
          , r = await this._rpcRequest("getVoteAccounts", t)
          , s = superstruct.create(r, GetVoteAccounts);
        if ("error"in s)
            throw new SolanaJSONRPCError(s.error,"failed to get vote accounts");
        return s.result
    }
    async getSlot(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, void 0, r)
          , n = await this._rpcRequest("getSlot", s)
          , o = superstruct.create(n, jsonRpcResult(superstruct.number()));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get slot");
        return o.result
    }
    async getSlotLeader(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, void 0, r)
          , n = await this._rpcRequest("getSlotLeader", s)
          , o = superstruct.create(n, jsonRpcResult(superstruct.string()));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get slot leader");
        return o.result
    }
    async getSlotLeaders(e, t) {
        const r = [e, t]
          , s = await this._rpcRequest("getSlotLeaders", r)
          , n = superstruct.create(s, jsonRpcResult(superstruct.array(PublicKeyFromString)));
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get slot leaders");
        return n.result
    }
    async getSignatureStatus(e, t) {
        const {context: r, value: s} = await this.getSignatureStatuses([e], t);
        assert(1 === s.length);
        return {
            context: r,
            value: s[0]
        }
    }
    async getSignatureStatuses(e, t) {
        const r = [e];
        t && r.push(t);
        const s = await this._rpcRequest("getSignatureStatuses", r)
          , n = superstruct.create(s, GetSignatureStatusesRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get signature status");
        return n.result
    }
    async getTransactionCount(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, void 0, r)
          , n = await this._rpcRequest("getTransactionCount", s)
          , o = superstruct.create(n, jsonRpcResult(superstruct.number()));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get transaction count");
        return o.result
    }
    async getTotalSupply(e) {
        return (await this.getSupply({
            commitment: e,
            excludeNonCirculatingAccountsList: !0
        })).value.total
    }
    async getInflationGovernor(e) {
        const t = this._buildArgs([], e)
          , r = await this._rpcRequest("getInflationGovernor", t)
          , s = superstruct.create(r, GetInflationGovernorRpcResult);
        if ("error"in s)
            throw new SolanaJSONRPCError(s.error,"failed to get inflation");
        return s.result
    }
    async getInflationReward(e, t, r) {
        const {commitment: s, config: n} = extractCommitmentFromConfig(r)
          , o = this._buildArgs([e.map((e => e.toBase58()))], s, void 0, {
            ...n,
            epoch: null != t ? t : n?.epoch
        })
          , a = await this._rpcRequest("getInflationReward", o)
          , i = superstruct.create(a, GetInflationRewardResult);
        if ("error"in i)
            throw new SolanaJSONRPCError(i.error,"failed to get inflation reward");
        return i.result
    }
    async getInflationRate() {
        const e = await this._rpcRequest("getInflationRate", [])
          , t = superstruct.create(e, GetInflationRateRpcResult);
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get inflation rate");
        return t.result
    }
    async getEpochInfo(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, void 0, r)
          , n = await this._rpcRequest("getEpochInfo", s)
          , o = superstruct.create(n, GetEpochInfoRpcResult);
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get epoch info");
        return o.result
    }
    async getEpochSchedule() {
        const e = await this._rpcRequest("getEpochSchedule", [])
          , t = superstruct.create(e, GetEpochScheduleRpcResult);
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get epoch schedule");
        const r = t.result;
        return new EpochSchedule(r.slotsPerEpoch,r.leaderScheduleSlotOffset,r.warmup,r.firstNormalEpoch,r.firstNormalSlot)
    }
    async getLeaderSchedule() {
        const e = await this._rpcRequest("getLeaderSchedule", [])
          , t = superstruct.create(e, GetLeaderScheduleRpcResult);
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get leader schedule");
        return t.result
    }
    async getMinimumBalanceForRentExemption(e, t) {
        const r = this._buildArgs([e], t)
          , s = await this._rpcRequest("getMinimumBalanceForRentExemption", r)
          , n = superstruct.create(s, GetMinimumBalanceForRentExemptionRpcResult);
        return "error"in n ? (console.warn("Unable to fetch minimum balance for rent exemption"),
        0) : n.result
    }
    async getRecentBlockhashAndContext(e) {
        const {context: t, value: {blockhash: r}} = await this.getLatestBlockhashAndContext(e);
        return {
            context: t,
            value: {
                blockhash: r,
                feeCalculator: {
                    get lamportsPerSignature() {
                        throw new Error("The capability to fetch `lamportsPerSignature` using the `getRecentBlockhash` API is no longer offered by the network. Use the `getFeeForMessage` API to obtain the fee for a given message.")
                    },
                    toJSON: () => ({})
                }
            }
        }
    }
    async getRecentPerformanceSamples(e) {
        const t = await this._rpcRequest("getRecentPerformanceSamples", e ? [e] : [])
          , r = superstruct.create(t, GetRecentPerformanceSamplesRpcResult);
        if ("error"in r)
            throw new SolanaJSONRPCError(r.error,"failed to get recent performance samples");
        return r.result
    }
    async getFeeCalculatorForBlockhash(e, t) {
        const r = this._buildArgs([e], t)
          , s = await this._rpcRequest("getFeeCalculatorForBlockhash", r)
          , n = superstruct.create(s, GetFeeCalculatorRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get fee calculator");
        const {context: o, value: a} = n.result;
        return {
            context: o,
            value: null !== a ? a.feeCalculator : null
        }
    }
    async getFeeForMessage(e, t) {
        const r = toBuffer(e.serialize()).toString("base64")
          , s = this._buildArgs([r], t)
          , n = await this._rpcRequest("getFeeForMessage", s)
          , o = superstruct.create(n, jsonRpcResultAndContext(superstruct.nullable(superstruct.number())));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get fee for message");
        if (null === o.result)
            throw new Error("invalid blockhash");
        return o.result
    }
    async getRecentPrioritizationFees(e) {
        const t = e?.lockedWritableAccounts?.map((e => e.toBase58()))
          , r = t?.length ? [t] : []
          , s = await this._rpcRequest("getRecentPrioritizationFees", r)
          , n = superstruct.create(s, GetRecentPrioritizationFeesRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get recent prioritization fees");
        return n.result
    }
    async getRecentBlockhash(e) {
        try {
            return (await this.getRecentBlockhashAndContext(e)).value
        } catch (e) {
            throw new Error("failed to get recent blockhash: " + e)
        }
    }
    async getLatestBlockhash(e) {
        try {
            return (await this.getLatestBlockhashAndContext(e)).value
        } catch (e) {
            throw new Error("failed to get recent blockhash: " + e)
        }
    }
    async getLatestBlockhashAndContext(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, void 0, r)
          , n = await this._rpcRequest("getLatestBlockhash", s)
          , o = superstruct.create(n, GetLatestBlockhashRpcResult);
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get latest blockhash");
        return o.result
    }
    async isBlockhashValid(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgs([e], r, void 0, s)
          , o = await this._rpcRequest("isBlockhashValid", n)
          , a = superstruct.create(o, IsBlockhashValidRpcResult);
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,"failed to determine if the blockhash `" + e + "`is valid");
        return a.result
    }
    async getVersion() {
        const e = await this._rpcRequest("getVersion", [])
          , t = superstruct.create(e, jsonRpcResult(VersionResult));
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get version");
        return t.result
    }
    async getGenesisHash() {
        const e = await this._rpcRequest("getGenesisHash", [])
          , t = superstruct.create(e, jsonRpcResult(superstruct.string()));
        if ("error"in t)
            throw new SolanaJSONRPCError(t.error,"failed to get genesis hash");
        return t.result
    }
    async getBlock(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgsAtLeastConfirmed([e], r, void 0, s)
          , o = await this._rpcRequest("getBlock", n);
        try {
            switch (s?.transactionDetails) {
            case "accounts":
                {
                    const e = superstruct.create(o, GetAccountsModeBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    return e.result
                }
            case "none":
                {
                    const e = superstruct.create(o, GetNoneModeBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    return e.result
                }
            default:
                {
                    const e = superstruct.create(o, GetBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    const {result: t} = e;
                    return t ? {
                        ...t,
                        transactions: t.transactions.map(( ({transaction: e, meta: t, version: r}) => ({
                            meta: t,
                            transaction: {
                                ...e,
                                message: versionedMessageFromResponse(r, e.message)
                            },
                            version: r
                        })))
                    } : null
                }
            }
        } catch (e) {
            throw new SolanaJSONRPCError(e,"failed to get confirmed block")
        }
    }
    async getParsedBlock(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgsAtLeastConfirmed([e], r, "jsonParsed", s)
          , o = await this._rpcRequest("getBlock", n);
        try {
            switch (s?.transactionDetails) {
            case "accounts":
                {
                    const e = superstruct.create(o, GetParsedAccountsModeBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    return e.result
                }
            case "none":
                {
                    const e = superstruct.create(o, GetParsedNoneModeBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    return e.result
                }
            default:
                {
                    const e = superstruct.create(o, GetParsedBlockRpcResult);
                    if ("error"in e)
                        throw e.error;
                    return e.result
                }
            }
        } catch (e) {
            throw new SolanaJSONRPCError(e,"failed to get block")
        }
    }
    async getBlockProduction(e) {
        let t, r;
        if ("string" == typeof e)
            r = e;
        else if (e) {
            const {commitment: s, ...n} = e;
            r = s,
            t = n
        }
        const s = this._buildArgs([], r, "base64", t)
          , n = await this._rpcRequest("getBlockProduction", s)
          , o = superstruct.create(n, BlockProductionResponseStruct);
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get block production information");
        return o.result
    }
    async getTransaction(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgsAtLeastConfirmed([e], r, void 0, s)
          , o = await this._rpcRequest("getTransaction", n)
          , a = superstruct.create(o, GetTransactionRpcResult);
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,"failed to get transaction");
        const i = a.result;
        return i ? {
            ...i,
            transaction: {
                ...i.transaction,
                message: versionedMessageFromResponse(i.version, i.transaction.message)
            }
        } : i
    }
    async getParsedTransaction(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = this._buildArgsAtLeastConfirmed([e], r, "jsonParsed", s)
          , o = await this._rpcRequest("getTransaction", n)
          , a = superstruct.create(o, GetParsedTransactionRpcResult);
        if ("error"in a)
            throw new SolanaJSONRPCError(a.error,"failed to get transaction");
        return a.result
    }
    async getParsedTransactions(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = e.map((e => ({
            methodName: "getTransaction",
            args: this._buildArgsAtLeastConfirmed([e], r, "jsonParsed", s)
        })));
        return (await this._rpcBatchRequest(n)).map((e => {
            const t = superstruct.create(e, GetParsedTransactionRpcResult);
            if ("error"in t)
                throw new SolanaJSONRPCError(t.error,"failed to get transactions");
            return t.result
        }
        ))
    }
    async getTransactions(e, t) {
        const {commitment: r, config: s} = extractCommitmentFromConfig(t)
          , n = e.map((e => ({
            methodName: "getTransaction",
            args: this._buildArgsAtLeastConfirmed([e], r, void 0, s)
        })));
        return (await this._rpcBatchRequest(n)).map((e => {
            const t = superstruct.create(e, GetTransactionRpcResult);
            if ("error"in t)
                throw new SolanaJSONRPCError(t.error,"failed to get transactions");
            const r = t.result;
            return r ? {
                ...r,
                transaction: {
                    ...r.transaction,
                    message: versionedMessageFromResponse(r.version, r.transaction.message)
                }
            } : r
        }
        ))
    }
    async getConfirmedBlock(e, t) {
        const r = this._buildArgsAtLeastConfirmed([e], t)
          , s = await this._rpcRequest("getBlock", r)
          , n = superstruct.create(s, GetConfirmedBlockRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get confirmed block");
        const o = n.result;
        if (!o)
            throw new Error("Confirmed block " + e + " not found");
        const a = {
            ...o,
            transactions: o.transactions.map(( ({transaction: e, meta: t}) => {
                const r = new Message(e.message);
                return {
                    meta: t,
                    transaction: {
                        ...e,
                        message: r
                    }
                }
            }
            ))
        };
        return {
            ...a,
            transactions: a.transactions.map(( ({transaction: e, meta: t}) => ({
                meta: t,
                transaction: Transaction.populate(e.message, e.signatures)
            })))
        }
    }
    async getBlocks(e, t, r) {
        const s = this._buildArgsAtLeastConfirmed(void 0 !== t ? [e, t] : [e], r)
          , n = await this._rpcRequest("getBlocks", s)
          , o = superstruct.create(n, jsonRpcResult(superstruct.array(superstruct.number())));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get blocks");
        return o.result
    }
    async getBlockSignatures(e, t) {
        const r = this._buildArgsAtLeastConfirmed([e], t, void 0, {
            transactionDetails: "signatures",
            rewards: !1
        })
          , s = await this._rpcRequest("getBlock", r)
          , n = superstruct.create(s, GetBlockSignaturesRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get block");
        const o = n.result;
        if (!o)
            throw new Error("Block " + e + " not found");
        return o
    }
    async getConfirmedBlockSignatures(e, t) {
        const r = this._buildArgsAtLeastConfirmed([e], t, void 0, {
            transactionDetails: "signatures",
            rewards: !1
        })
          , s = await this._rpcRequest("getBlock", r)
          , n = superstruct.create(s, GetBlockSignaturesRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get confirmed block");
        const o = n.result;
        if (!o)
            throw new Error("Confirmed block " + e + " not found");
        return o
    }
    async getConfirmedTransaction(e, t) {
        const r = this._buildArgsAtLeastConfirmed([e], t)
          , s = await this._rpcRequest("getTransaction", r)
          , n = superstruct.create(s, GetTransactionRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get transaction");
        const o = n.result;
        if (!o)
            return o;
        const a = new Message(o.transaction.message)
          , i = o.transaction.signatures;
        return {
            ...o,
            transaction: Transaction.populate(a, i)
        }
    }
    async getParsedConfirmedTransaction(e, t) {
        const r = this._buildArgsAtLeastConfirmed([e], t, "jsonParsed")
          , s = await this._rpcRequest("getTransaction", r)
          , n = superstruct.create(s, GetParsedTransactionRpcResult);
        if ("error"in n)
            throw new SolanaJSONRPCError(n.error,"failed to get confirmed transaction");
        return n.result
    }
    async getParsedConfirmedTransactions(e, t) {
        const r = e.map((e => ({
            methodName: "getTransaction",
            args: this._buildArgsAtLeastConfirmed([e], t, "jsonParsed")
        })));
        return (await this._rpcBatchRequest(r)).map((e => {
            const t = superstruct.create(e, GetParsedTransactionRpcResult);
            if ("error"in t)
                throw new SolanaJSONRPCError(t.error,"failed to get confirmed transactions");
            return t.result
        }
        ))
    }
    async getConfirmedSignaturesForAddress(e, t, r) {
        let s = {}
          , n = await this.getFirstAvailableBlock();
        for (; !("until"in s) && !(--t <= 0 || t < n); )
            try {
                const e = await this.getConfirmedBlockSignatures(t, "finalized");
                e.signatures.length > 0 && (s.until = e.signatures[e.signatures.length - 1].toString())
            } catch (e) {
                if (e instanceof Error && e.message.includes("skipped"))
                    continue;
                throw e
            }
        let o = await this.getSlot("finalized");
        for (; !("before"in s || ++r > o); )
            try {
                const e = await this.getConfirmedBlockSignatures(r);
                e.signatures.length > 0 && (s.before = e.signatures[e.signatures.length - 1].toString())
            } catch (e) {
                if (e instanceof Error && e.message.includes("skipped"))
                    continue;
                throw e
            }
        return (await this.getConfirmedSignaturesForAddress2(e, s)).map((e => e.signature))
    }
    async getConfirmedSignaturesForAddress2(e, t, r) {
        const s = this._buildArgsAtLeastConfirmed([e.toBase58()], r, void 0, t)
          , n = await this._rpcRequest("getConfirmedSignaturesForAddress2", s)
          , o = superstruct.create(n, GetConfirmedSignaturesForAddress2RpcResult);
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get confirmed signatures for address");
        return o.result
    }
    async getSignaturesForAddress(e, t, r) {
        const s = this._buildArgsAtLeastConfirmed([e.toBase58()], r, void 0, t)
          , n = await this._rpcRequest("getSignaturesForAddress", s)
          , o = superstruct.create(n, GetSignaturesForAddressRpcResult);
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get signatures for address");
        return o.result
    }
    async getAddressLookupTable(e, t) {
        const {context: r, value: s} = await this.getAccountInfoAndContext(e, t);
        let n = null;
        return null !== s && (n = new AddressLookupTableAccount({
            key: e,
            state: AddressLookupTableAccount.deserialize(s.data)
        })),
        {
            context: r,
            value: n
        }
    }
    async getNonceAndContext(e, t) {
        const {context: r, value: s} = await this.getAccountInfoAndContext(e, t);
        let n = null;
        return null !== s && (n = NonceAccount.fromAccountData(s.data)),
        {
            context: r,
            value: n
        }
    }
    async getNonce(e, t) {
        return await this.getNonceAndContext(e, t).then((e => e.value)).catch((t => {
            throw new Error("failed to get nonce for account " + e.toBase58() + ": " + t)
        }
        ))
    }
    async requestAirdrop(e, t) {
        const r = await this._rpcRequest("requestAirdrop", [e.toBase58(), t])
          , s = superstruct.create(r, RequestAirdropRpcResult);
        if ("error"in s)
            throw new SolanaJSONRPCError(s.error,`airdrop to ${e.toBase58()} failed`);
        return s.result
    }
    async _blockhashWithExpiryBlockHeight(e) {
        if (!e) {
            for (; this._pollingBlockhash; )
                await sleep(100);
            const e = Date.now() - this._blockhashInfo.lastFetch >= 3e4;
            if (null !== this._blockhashInfo.latestBlockhash && !e)
                return this._blockhashInfo.latestBlockhash
        }
        return await this._pollNewBlockhash()
    }
    async _pollNewBlockhash() {
        this._pollingBlockhash = !0;
        try {
            const e = Date.now()
              , t = this._blockhashInfo.latestBlockhash
              , r = t ? t.blockhash : null;
            for (let e = 0; e < 50; e++) {
                const e = await this.getLatestBlockhash("finalized");
                if (r !== e.blockhash)
                    return this._blockhashInfo = {
                        latestBlockhash: e,
                        lastFetch: Date.now(),
                        transactionSignatures: [],
                        simulatedSignatures: []
                    },
                    e;
                await sleep(200)
            }
            throw new Error(`Unable to obtain a new blockhash after ${Date.now() - e}ms`)
        } finally {
            this._pollingBlockhash = !1
        }
    }
    async getStakeMinimumDelegation(e) {
        const {commitment: t, config: r} = extractCommitmentFromConfig(e)
          , s = this._buildArgs([], t, "base64", r)
          , n = await this._rpcRequest("getStakeMinimumDelegation", s)
          , o = superstruct.create(n, jsonRpcResultAndContext(superstruct.number()));
        if ("error"in o)
            throw new SolanaJSONRPCError(o.error,"failed to get stake minimum delegation");
        return o.result
    }
    async simulateTransaction(e, t, r) {
        if ("message"in e) {
            const s = e.serialize()
              , n = buffer.Buffer.from(s).toString("base64");
            if (Array.isArray(t) || void 0 !== r)
                throw new Error("Invalid arguments");
            const o = t || {};
            o.encoding = "base64",
            "commitment"in o || (o.commitment = this.commitment),
            t && "object" == typeof t && "innerInstructions"in t && (o.innerInstructions = t.innerInstructions);
            const a = [n, o]
              , i = await this._rpcRequest("simulateTransaction", a)
              , u = superstruct.create(i, SimulatedTransactionResponseStruct);
            if ("error"in u)
                throw new Error("failed to simulate transaction: " + u.error.message);
            return u.result
        }
        let s;
        if (e instanceof Transaction) {
            let t = e;
            s = new Transaction,
            s.feePayer = t.feePayer,
            s.instructions = e.instructions,
            s.nonceInfo = t.nonceInfo,
            s.signatures = t.signatures
        } else
            s = Transaction.populate(e),
            s._message = s._json = void 0;
        if (void 0 !== t && !Array.isArray(t))
            throw new Error("Invalid arguments");
        const n = t;
        if (s.nonceInfo && n)
            s.sign(...n);
        else {
            let e = this._disableBlockhashCaching;
            for (; ; ) {
                const t = await this._blockhashWithExpiryBlockHeight(e);
                if (s.lastValidBlockHeight = t.lastValidBlockHeight,
                s.recentBlockhash = t.blockhash,
                !n)
                    break;
                if (s.sign(...n),
                !s.signature)
                    throw new Error("!signature");
                const r = s.signature.toString("base64");
                if (!this._blockhashInfo.simulatedSignatures.includes(r) && !this._blockhashInfo.transactionSignatures.includes(r)) {
                    this._blockhashInfo.simulatedSignatures.push(r);
                    break
                }
                e = !0
            }
        }
        const o = s._compile()
          , a = o.serialize()
          , i = s._serialize(a).toString("base64")
          , u = {
            encoding: "base64",
            commitment: this.commitment
        };
        if (r) {
            const e = (Array.isArray(r) ? r : o.nonProgramIds()).map((e => e.toBase58()));
            u.accounts = {
                encoding: "base64",
                addresses: e
            }
        }
        n && (u.sigVerify = !0),
        t && "object" == typeof t && "innerInstructions"in t && (u.innerInstructions = t.innerInstructions);
        const c = [i, u]
          , l = await this._rpcRequest("simulateTransaction", c)
          , p = superstruct.create(l, SimulatedTransactionResponseStruct);
        if ("error"in p) {
            let e;
            if ("data"in p.error && (e = p.error.data.logs,
            e && Array.isArray(e))) {
                const t = "\n    "
                  , r = t + e.join(t);
                console.error(p.error.message, r)
            }
            throw new SendTransactionError({
                action: "simulate",
                signature: "",
                transactionMessage: p.error.message,
                logs: e
            })
        }
        return p.result
    }
    async sendTransaction(e, t, r) {
        if ("version"in e) {
            if (t && Array.isArray(t))
                throw new Error("Invalid arguments");
            const r = e.serialize();
            return await this.sendRawTransaction(r, t)
        }
        if (void 0 === t || !Array.isArray(t))
            throw new Error("Invalid arguments");
        const s = t;
        if (e.nonceInfo)
            e.sign(...s);
        else {
            let t = this._disableBlockhashCaching;
            for (; ; ) {
                const r = await this._blockhashWithExpiryBlockHeight(t);
                if (e.lastValidBlockHeight = r.lastValidBlockHeight,
                e.recentBlockhash = r.blockhash,
                e.sign(...s),
                !e.signature)
                    throw new Error("!signature");
                const n = e.signature.toString("base64");
                if (!this._blockhashInfo.transactionSignatures.includes(n)) {
                    this._blockhashInfo.transactionSignatures.push(n);
                    break
                }
                t = !0
            }
        }
        const n = e.serialize();
        return await this.sendRawTransaction(n, r)
    }
    async sendRawTransaction(e, t) {
        const r = toBuffer(e).toString("base64");
        return await this.sendEncodedTransaction(r, t)
    }
    async sendEncodedTransaction(e, t) {
        const r = {
            encoding: "base64"
        }
          , s = t && t.skipPreflight
          , n = !0 === s ? "processed" : t && t.preflightCommitment || this.commitment;
        t && null != t.maxRetries && (r.maxRetries = t.maxRetries),
        t && null != t.minContextSlot && (r.minContextSlot = t.minContextSlot),
        s && (r.skipPreflight = s),
        n && (r.preflightCommitment = n);
        const o = [e, r]
          , a = await this._rpcRequest("sendTransaction", o)
          , i = superstruct.create(a, SendTransactionRpcResult);
        if ("error"in i) {
            let e;
            throw "data"in i.error && (e = i.error.data.logs),
            new SendTransactionError({
                action: s ? "send" : "simulate",
                signature: "",
                transactionMessage: i.error.message,
                logs: e
            })
        }
        return i.result
    }
    _wsOnOpen() {
        this._rpcWebSocketConnected = !0,
        this._rpcWebSocketHeartbeat = setInterval(( () => {
            (async () => {
                try {
                    await this._rpcWebSocket.notify("ping")
                } catch {}
            }
            )()
        }
        ), 5e3),
        this._updateSubscriptions()
    }
    _wsOnError(e) {
        this._rpcWebSocketConnected = !1,
        console.error("ws error:", e.message)
    }
    _wsOnClose(e) {
        this._rpcWebSocketConnected = !1,
        this._rpcWebSocketGeneration = (this._rpcWebSocketGeneration + 1) % Number.MAX_SAFE_INTEGER,
        this._rpcWebSocketIdleTimeout && (clearTimeout(this._rpcWebSocketIdleTimeout),
        this._rpcWebSocketIdleTimeout = null),
        this._rpcWebSocketHeartbeat && (clearInterval(this._rpcWebSocketHeartbeat),
        this._rpcWebSocketHeartbeat = null),
        1e3 !== e ? (this._subscriptionCallbacksByServerSubscriptionId = {},
        Object.entries(this._subscriptionsByHash).forEach(( ([e,t]) => {
            this._setSubscription(e, {
                ...t,
                state: "pending"
            })
        }
        ))) : this._updateSubscriptions()
    }
    _setSubscription(e, t) {
        const r = this._subscriptionsByHash[e]?.state;
        if (this._subscriptionsByHash[e] = t,
        r !== t.state) {
            const r = this._subscriptionStateChangeCallbacksByHash[e];
            r && r.forEach((e => {
                try {
                    e(t.state)
                } catch {}
            }
            ))
        }
    }
    _onSubscriptionStateChange(e, t) {
        const r = this._subscriptionHashByClientSubscriptionId[e];
        if (null == r)
            return () => {}
            ;
        const s = this._subscriptionStateChangeCallbacksByHash[r] ||= new Set;
        return s.add(t),
        () => {
            s.delete(t),
            0 === s.size && delete this._subscriptionStateChangeCallbacksByHash[r]
        }
    }
    async _updateSubscriptions() {
        if (0 === Object.keys(this._subscriptionsByHash).length)
            return void (this._rpcWebSocketConnected && (this._rpcWebSocketConnected = !1,
            this._rpcWebSocketIdleTimeout = setTimeout(( () => {
                this._rpcWebSocketIdleTimeout = null;
                try {
                    this._rpcWebSocket.close()
                } catch (e) {
                    e instanceof Error && console.log(`Error when closing socket connection: ${e.message}`)
                }
            }
            ), 500)));
        if (null !== this._rpcWebSocketIdleTimeout && (clearTimeout(this._rpcWebSocketIdleTimeout),
        this._rpcWebSocketIdleTimeout = null,
        this._rpcWebSocketConnected = !0),
        !this._rpcWebSocketConnected)
            return void this._rpcWebSocket.connect();
        const e = this._rpcWebSocketGeneration
          , t = () => e === this._rpcWebSocketGeneration;
        await Promise.all(Object.keys(this._subscriptionsByHash).map((async e => {
            const r = this._subscriptionsByHash[e];
            if (void 0 !== r)
                switch (r.state) {
                case "pending":
                case "unsubscribed":
                    if (0 === r.callbacks.size)
                        return delete this._subscriptionsByHash[e],
                        "unsubscribed" === r.state && delete this._subscriptionCallbacksByServerSubscriptionId[r.serverSubscriptionId],
                        void await this._updateSubscriptions();
                    await (async () => {
                        const {args: s, method: n} = r;
                        try {
                            this._setSubscription(e, {
                                ...r,
                                state: "subscribing"
                            });
                            const t = await this._rpcWebSocket.call(n, s);
                            this._setSubscription(e, {
                                ...r,
                                serverSubscriptionId: t,
                                state: "subscribed"
                            }),
                            this._subscriptionCallbacksByServerSubscriptionId[t] = r.callbacks,
                            await this._updateSubscriptions()
                        } catch (o) {
                            if (console.error(`Received ${oinstanceof Error ? "" : "JSON-RPC "}error calling \`${n}\``, {
                                args: s,
                                error: o
                            }),
                            !t())
                                return;
                            this._setSubscription(e, {
                                ...r,
                                state: "pending"
                            }),
                            await this._updateSubscriptions()
                        }
                    }
                    )();
                    break;
                case "subscribed":
                    0 === r.callbacks.size && await (async () => {
                        const {serverSubscriptionId: s, unsubscribeMethod: n} = r;
                        if (this._subscriptionsAutoDisposedByRpc.has(s))
                            this._subscriptionsAutoDisposedByRpc.delete(s);
                        else {
                            this._setSubscription(e, {
                                ...r,
                                state: "unsubscribing"
                            }),
                            this._setSubscription(e, {
                                ...r,
                                state: "unsubscribing"
                            });
                            try {
                                await this._rpcWebSocket.call(n, [s])
                            } catch (s) {
                                if (s instanceof Error && console.error(`${n} error:`, s.message),
                                !t())
                                    return;
                                return this._setSubscription(e, {
                                    ...r,
                                    state: "subscribed"
                                }),
                                void await this._updateSubscriptions()
                            }
                        }
                        this._setSubscription(e, {
                            ...r,
                            state: "unsubscribed"
                        }),
                        await this._updateSubscriptions()
                    }
                    )()
                }
        }
        )))
    }
    _handleServerNotification(e, t) {
        const r = this._subscriptionCallbacksByServerSubscriptionId[e];
        void 0 !== r && r.forEach((e => {
            try {
                e(...t)
            } catch (e) {
                console.error(e)
            }
        }
        ))
    }
    _wsOnAccountNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, AccountNotificationResult);
        this._handleServerNotification(r, [t.value, t.context])
    }
    _makeSubscription(e, t) {
        const r = this._nextClientSubscriptionId++
          , s = fastStableStringify([e.method, t])
          , n = this._subscriptionsByHash[s];
        return void 0 === n ? this._subscriptionsByHash[s] = {
            ...e,
            args: t,
            callbacks: new Set([e.callback]),
            state: "pending"
        } : n.callbacks.add(e.callback),
        this._subscriptionHashByClientSubscriptionId[r] = s,
        this._subscriptionDisposeFunctionsByClientSubscriptionId[r] = async () => {
            delete this._subscriptionDisposeFunctionsByClientSubscriptionId[r],
            delete this._subscriptionHashByClientSubscriptionId[r];
            const t = this._subscriptionsByHash[s];
            assert(void 0 !== t, `Could not find a \`Subscription\` when tearing down client subscription #${r}`),
            t.callbacks.delete(e.callback),
            await this._updateSubscriptions()
        }
        ,
        this._updateSubscriptions(),
        r
    }
    onAccountChange(e, t, r) {
        const {commitment: s, config: n} = extractCommitmentFromConfig(r)
          , o = this._buildArgs([e.toBase58()], s || this._commitment || "finalized", "base64", n);
        return this._makeSubscription({
            callback: t,
            method: "accountSubscribe",
            unsubscribeMethod: "accountUnsubscribe"
        }, o)
    }
    async removeAccountChangeListener(e) {
        await this._unsubscribeClientSubscription(e, "account change")
    }
    _wsOnProgramAccountNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, ProgramAccountNotificationResult);
        this._handleServerNotification(r, [{
            accountId: t.value.pubkey,
            accountInfo: t.value.account
        }, t.context])
    }
    onProgramAccountChange(e, t, r, s) {
        const {commitment: n, config: o} = extractCommitmentFromConfig(r)
          , a = this._buildArgs([e.toBase58()], n || this._commitment || "finalized", "base64", o || (s ? {
            filters: applyDefaultMemcmpEncodingToFilters(s)
        } : void 0));
        return this._makeSubscription({
            callback: t,
            method: "programSubscribe",
            unsubscribeMethod: "programUnsubscribe"
        }, a)
    }
    async removeProgramAccountChangeListener(e) {
        await this._unsubscribeClientSubscription(e, "program account change")
    }
    onLogs(e, t, r) {
        const s = this._buildArgs(["object" == typeof e ? {
            mentions: [e.toString()]
        } : e], r || this._commitment || "finalized");
        return this._makeSubscription({
            callback: t,
            method: "logsSubscribe",
            unsubscribeMethod: "logsUnsubscribe"
        }, s)
    }
    async removeOnLogsListener(e) {
        await this._unsubscribeClientSubscription(e, "logs")
    }
    _wsOnLogsNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, LogsNotificationResult);
        this._handleServerNotification(r, [t.value, t.context])
    }
    _wsOnSlotNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, SlotNotificationResult);
        this._handleServerNotification(r, [t])
    }
    onSlotChange(e) {
        return this._makeSubscription({
            callback: e,
            method: "slotSubscribe",
            unsubscribeMethod: "slotUnsubscribe"
        }, [])
    }
    async removeSlotChangeListener(e) {
        await this._unsubscribeClientSubscription(e, "slot change")
    }
    _wsOnSlotUpdatesNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, SlotUpdateNotificationResult);
        this._handleServerNotification(r, [t])
    }
    onSlotUpdate(e) {
        return this._makeSubscription({
            callback: e,
            method: "slotsUpdatesSubscribe",
            unsubscribeMethod: "slotsUpdatesUnsubscribe"
        }, [])
    }
    async removeSlotUpdateListener(e) {
        await this._unsubscribeClientSubscription(e, "slot update")
    }
    async _unsubscribeClientSubscription(e, t) {
        const r = this._subscriptionDisposeFunctionsByClientSubscriptionId[e];
        r ? await r() : console.warn(`Ignored unsubscribe request because an active subscription with id \`${e}\` for '${t}' events could not be found.`)
    }
    _buildArgs(e, t, r, s) {
        const n = t || this._commitment;
        if (n || r || s) {
            let t = {};
            r && (t.encoding = r),
            n && (t.commitment = n),
            s && (t = Object.assign(t, s)),
            e.push(t)
        }
        return e
    }
    _buildArgsAtLeastConfirmed(e, t, r, s) {
        const n = t || this._commitment;
        if (n && !["confirmed", "finalized"].includes(n))
            throw new Error("Using Connection with default commitment: `" + this._commitment + "`, but method requires at least `confirmed`");
        return this._buildArgs(e, t, r, s)
    }
    _wsOnSignatureNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, SignatureNotificationResult);
        "receivedSignature" !== t.value && this._subscriptionsAutoDisposedByRpc.add(r),
        this._handleServerNotification(r, "receivedSignature" === t.value ? [{
            type: "received"
        }, t.context] : [{
            type: "status",
            result: t.value
        }, t.context])
    }
    onSignature(e, t, r) {
        const s = this._buildArgs([e], r || this._commitment || "finalized")
          , n = this._makeSubscription({
            callback: (e, r) => {
                if ("status" === e.type) {
                    t(e.result, r);
                    try {
                        this.removeSignatureListener(n)
                    } catch (e) {}
                }
            }
            ,
            method: "signatureSubscribe",
            unsubscribeMethod: "signatureUnsubscribe"
        }, s);
        return n
    }
    onSignatureWithOptions(e, t, r) {
        const {commitment: s, ...n} = {
            ...r,
            commitment: r && r.commitment || this._commitment || "finalized"
        }
          , o = this._buildArgs([e], s, void 0, n)
          , a = this._makeSubscription({
            callback: (e, r) => {
                t(e, r);
                try {
                    this.removeSignatureListener(a)
                } catch (e) {}
            }
            ,
            method: "signatureSubscribe",
            unsubscribeMethod: "signatureUnsubscribe"
        }, o);
        return a
    }
    async removeSignatureListener(e) {
        await this._unsubscribeClientSubscription(e, "signature result")
    }
    _wsOnRootNotification(e) {
        const {result: t, subscription: r} = superstruct.create(e, RootNotificationResult);
        this._handleServerNotification(r, [t])
    }
    onRootChange(e) {
        return this._makeSubscription({
            callback: e,
            method: "rootSubscribe",
            unsubscribeMethod: "rootUnsubscribe"
        }, [])
    }
    async removeRootChangeListener(e) {
        await this._unsubscribeClientSubscription(e, "root change")
    }
}