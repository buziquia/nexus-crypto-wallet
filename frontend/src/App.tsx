import { useEffect, useMemo, useState } from "react";
import api from "./api";

interface Profile {
  email: string;
  balances: {
    BRL: number;
    BTC: number;
    ETH: number;
  };
}

interface LedgerEntry {
  id?: string;
  type: string;
  token: string;
  amount: number | string;
  createdAt: string;
}

interface TransactionItem {
  id: string;
  type: string;
  tokenFrom: string | null;
  tokenTo: string | null;
  amount: number | null;
  fee: number | null;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [transactionsPagination, setTransactionsPagination] =
    useState<PaginationMeta>({
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 1,
    });

  const [activeTab, setActiveTab] = useState<"ledger" | "transactions">("ledger");

  const [amount, setAmount] = useState("");
  const [targetToken, setTargetToken] = useState("BTC");
  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [quote, setQuote] = useState<{
    tokenOut: string;
    amountBRL: number;
    tax: number;
    conversionRate: number;
    estimatedAmountOut: number;
  } | null>(null);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    setToken("");
    setProfile(null);
    setHistory([]);
    setTransactions([]);
    setQuote(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isRegistering ? "/auth/register" : "/auth/login";
      const res = await api.post(endpoint, { email, pass });

      if (isRegistering) {
        alert("Conta criada com sucesso. Faça login para continuar.");
        setIsRegistering(false);
        setPass("");
      } else {
        localStorage.setItem("token", res.data.access_token);
        if (res.data.refresh_token) {
          localStorage.setItem("refresh_token", res.data.refresh_token);
        }
        setToken(res.data.access_token);
      }
    } catch (err: any) {
      alert("Erro: " + (err.response?.data?.message || "Falha na autenticação"));
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    const res = await api.get("/auth/profile");
    setProfile(res.data);
  };

  const fetchHistory = async (page = historyPagination.page, limit = historyPagination.limit) => {
    const res = await api.get(`/auth/history?page=${page}&limit=${limit}`);
    setHistory(Array.isArray(res.data?.data) ? res.data.data : []);
    setHistoryPagination(
      res.data?.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 1,
      }
    );
  };

  const fetchTransactions = async (
    page = transactionsPagination.page,
    limit = transactionsPagination.limit
  ) => {
    const res = await api.get(`/auth/transactions?page=${page}&limit=${limit}`);
    setTransactions(Array.isArray(res.data?.data) ? res.data.data : []);
    setTransactionsPagination(
      res.data?.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 1,
      }
    );
  };

  const fetchData = async () => {
    if (!token) return;

    setScreenLoading(true);
    try {
      await Promise.all([
        fetchProfile(),
        fetchHistory(1, historyPagination.limit),
        fetchTransactions(1, transactionsPagination.limit),
      ]);
    } catch {
      logout();
    } finally {
      setScreenLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || Number(amount) <= 0) {
        setQuote(null);
        return;
      }

      try {
        const res = await api.get(
          `/auth/swap/quote?amount=${Number(amount)}&token=${targetToken}`
        );
        setQuote(res.data);
      } catch {
        setQuote(null);
      }
    };

    const timeout = setTimeout(() => {
      if (token) fetchQuote();
    }, 350);

    return () => clearTimeout(timeout);
  }, [amount, targetToken, token]);

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      return alert("Digite um valor válido");
    }

    setLoading(true);

    try {
      await api.post("/auth/deposit", { amount: Number(amount) });
      setAmount("");
      setQuote(null);
      await fetchData();
      alert("Depósito realizado com sucesso!");
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao depositar");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!amount || Number(amount) <= 0) {
      return alert("Digite o valor em BRL");
    }

    setLoading(true);

    try {
      await api.post("/auth/swap/execute", {
        amount: Number(amount),
        token: targetToken,
      });
      setAmount("");
      setQuote(null);
      await fetchData();
      alert("Swap realizado com sucesso!");
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao executar swap");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) {
      return alert("Digite um valor válido");
    }

    setLoading(true);

    try {
      await api.post("/auth/withdraw", {
        amount: Number(amount),
        token: "BRL",
      });
      setAmount("");
      setQuote(null);
      await fetchData();
      alert("Saque solicitado com sucesso!");
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao sacar");
    } finally {
      setLoading(false);
    }
  };

  const currentAssetSummary = useMemo(() => {
    if (!quote) return null;

    return {
      receiveText:
        quote.tokenOut === "BTC"
          ? `${Number(quote.estimatedAmountOut).toFixed(8)} BTC`
          : `${Number(quote.estimatedAmountOut).toFixed(8)} ETH`,
      feeText: `R$ ${Number(quote.tax).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })}`,
      rateText: `R$ ${Number(quote.conversionRate).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })}`,
    };
  }, [quote]);

  const PaginationControls = ({
    pagination,
    onChangePage,
  }: {
    pagination: PaginationMeta;
    onChangePage: (page: number) => void;
  }) => (
    <div className="flex items-center justify-between pt-4 border-t mt-4">
      <p className="text-xs text-gray-500">
        Página {pagination.page} de {Math.max(1, pagination.totalPages)} •{" "}
        {pagination.total} itens
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onChangePage(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-white"
        >
          Anterior
        </button>
        <button
          onClick={() => onChangePage(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-white"
        >
          Próxima
        </button>
      </div>
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-[28px] shadow-2xl overflow-hidden border border-slate-200">
          <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-blue-700 p-10 text-white">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-200 mb-3">
                Nexus Wallet
              </p>
              <h1 className="text-4xl font-black leading-tight">
                Carteira cripto simplificada com foco em ledger e rastreabilidade.
              </h1>
              <p className="mt-6 text-blue-100/90 leading-7">
                Faça login para acompanhar seus saldos, executar swaps, consultar
                movimentações e visualizar o histórico de transações.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-blue-100 mb-1">Moedas</p>
                <p className="text-xl font-bold">3</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-blue-100 mb-1">Taxa swap</p>
                <p className="text-xl font-bold">1,5%</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-blue-100 mb-1">Ledger</p>
                <p className="text-xl font-bold">Auditável</p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="md:hidden mb-8">
              <h1 className="text-3xl font-black text-blue-950">NEXUS.WALLET</h1>
              <p className="text-sm text-slate-500 mt-2">
                Carteira cripto simplificada
              </p>
            </div>

            <form onSubmit={handleAuth} className="max-w-md mx-auto">
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                {isRegistering ? "Criar conta" : "Entrar"}
              </h2>
              <p className="text-sm text-slate-500 mb-8">
                {isRegistering
                  ? "Cadastre um usuário para começar com carteira zerada."
                  : "Acesse sua carteira para consultar saldos e movimentações."}
              </p>

              <input
                type="email"
                placeholder="Seu email"
                className="w-full p-4 mb-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Sua senha"
                className="w-full p-4 mb-6 border border-slate-200 rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setPass(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 transition text-white p-4 rounded-2xl font-bold disabled:opacity-50"
              >
                {loading
                  ? "Processando..."
                  : isRegistering
                  ? "CRIAR CONTA"
                  : "ENTRAR"}
              </button>

              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
              >
                {isRegistering ? "Voltar para login" : "Criar nova conta"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">
              Nexus Wallet
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-blue-950">
              Painel da carteira
            </h1>
            <p className="text-slate-500 mt-2">
              Bem-vindo, <span className="font-semibold">{profile?.email}</span>
            </p>
          </div>

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 transition text-white px-5 py-3 rounded-2xl font-bold text-sm uppercase self-start md:self-auto"
          >
            Sair
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-400 mb-3">Reais</p>
            <h2 className="text-3xl font-black text-slate-950">
              R${" "}
              {profile?.balances?.BRL?.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              }) || "0,00"}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-400 mb-3">Bitcoin</p>
            <h2 className="text-3xl font-black text-orange-500">
              {profile?.balances?.BTC
                ? Number(profile.balances.BTC).toFixed(8)
                : "0.00000000"}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-400 mb-3">Ethereum</p>
            <h2 className="text-3xl font-black text-blue-600">
              {profile?.balances?.ETH
                ? Number(profile.balances.ETH).toFixed(8)
                : "0.00000000"}
            </h2>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-3xl p-6 shadow-sm text-white">
            <p className="text-xs font-bold uppercase text-blue-200 mb-3">
              Resumo do swap
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-blue-200">Taxa fixa</p>
                <p className="text-xl font-bold">1,5%</p>
              </div>
              <div>
                <p className="text-xs text-blue-200">Destino selecionado</p>
                <p className="text-xl font-bold">{targetToken}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 h-fit">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-950">Operações</h3>
              <p className="text-sm text-slate-500 mt-1">
                Deposite BRL, simule swap e solicite saque.
              </p>
            </div>

            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Valor em BRL
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-bold mb-4 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0,00"
            />

            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Token de destino
            </label>
            <select
              value={targetToken}
              onChange={(e) => setTargetToken(e.target.value)}
              className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-bold mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <p className="text-xs uppercase font-bold text-slate-400 mb-3">
                Prévia da cotação
              </p>

              {currentAssetSummary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Você recebe</span>
                    <span className="font-bold text-slate-900">
                      {currentAssetSummary.receiveText}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Taxa</span>
                    <span className="font-bold text-slate-900">
                      {currentAssetSummary.feeText}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Cotação usada</span>
                    <span className="font-bold text-slate-900">
                      {currentAssetSummary.rateText}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Digite um valor para visualizar a prévia do swap.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 transition text-white p-4 rounded-2xl font-bold disabled:opacity-50"
              >
                {loading ? "Processando..." : "DEPOSITAR BRL"}
              </button>

              <button
                onClick={handleSwap}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 transition text-white p-4 rounded-2xl font-bold disabled:opacity-50"
              >
                {loading ? "Processando..." : `EXECUTAR SWAP PARA ${targetToken}`}
              </button>

              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="bg-slate-900 hover:bg-slate-800 transition text-white p-4 rounded-2xl font-bold disabled:opacity-50"
              >
                {loading ? "Processando..." : "SOLICITAR SAQUE BRL"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-950">
                  Atividade da carteira
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Consulte movimentações do ledger e o histórico de transações.
                </p>
              </div>

              <div className="bg-slate-100 rounded-2xl p-1 flex gap-1 w-full md:w-auto">
                <button
                  onClick={() => setActiveTab("ledger")}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition ${
                    activeTab === "ledger"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Ledger
                </button>
                <button
                  onClick={() => setActiveTab("transactions")}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition ${
                    activeTab === "transactions"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Transactions
                </button>
              </div>
            </div>

            {screenLoading ? (
              <div className="h-[420px] flex items-center justify-center text-slate-500">
                Carregando dados...
              </div>
            ) : activeTab === "ledger" ? (
              <>
                <div className="space-y-4 min-h-[360px]">
                  {history.map((t, i) => (
                    <div
                      key={t.id || i}
                      className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"
                    >
                      <div>
                        <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg border uppercase">
                          {t.type}
                        </span>
                        <p className="text-slate-400 text-xs mt-2">
                          {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <p
                        className={`font-black text-right ${
                          Number(t.amount) > 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {Number(t.amount) > 0 ? "+" : ""}
                        {Number(t.amount).toFixed(t.token === "BRL" ? 2 : 8)}{" "}
                        {t.token}
                      </p>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <p className="text-sm text-slate-400">
                      Nenhuma movimentação encontrada.
                    </p>
                  )}
                </div>

                <PaginationControls
                  pagination={historyPagination}
                  onChangePage={(page) => fetchHistory(page, historyPagination.limit)}
                />
              </>
            ) : (
              <>
                <div className="space-y-4 min-h-[360px]">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg border uppercase">
                            {tx.type}
                          </span>
                          <p className="text-slate-400 text-xs mt-2">
                            {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-sm text-slate-700">
                          <p>
                            <span className="text-slate-500">Origem:</span>{" "}
                            <span className="font-bold">{tx.tokenFrom || "-"}</span>
                          </p>
                          <p>
                            <span className="text-slate-500">Destino:</span>{" "}
                            <span className="font-bold">{tx.tokenTo || "-"}</span>
                          </p>
                        </div>

                        <div className="text-sm text-right">
                          <p className="font-bold text-slate-900">
                            Valor:{" "}
                            {tx.amount !== null
                              ? Number(tx.amount).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })
                              : "-"}
                          </p>
                          <p className="text-slate-500">
                            Taxa:{" "}
                            {tx.fee !== null
                              ? Number(tx.fee).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {transactions.length === 0 && (
                    <p className="text-sm text-slate-400">
                      Nenhuma transação encontrada.
                    </p>
                  )}
                </div>

                <PaginationControls
                  pagination={transactionsPagination}
                  onChangePage={(page) =>
                    fetchTransactions(page, transactionsPagination.limit)
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;