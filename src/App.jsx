import React, { useEffect, useMemo, useState } from "react";

const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL;

function uniq(arr) {
  return Array.from(new Set(arr.filter((v) => v !== "" && v !== null && v !== undefined)));
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState([]);

  // 入力項目
  const [code, setCode] = useState("");
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [dia, setDia] = useState("");
  const [location, setLocation] = useState("");
  const [qty, setQty] = useState("");

  // 任意
  const [hon, setHon] = useState("");
  const [note, setNote] = useState("");

  const [newMode, setNewMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  // --- マスタ取得 ---
  async function fetchMaster() {
    if (!GAS_WEBAPP_URL) throw new Error("GAS URL 未設定");

    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "master" }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "master取得失敗");

    setMaster(data.master || []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchMaster();
      } catch (e) {
        setMsg(`❌ ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- コード入力で自動補完 ---
  useEffect(() => {
    if (!code) return;
    const hit = master.find((r) => String(r.code) === String(code));
    if (hit) {
      setMaker(hit.maker);
      setModel(hit.model);
      setDia(String(hit.dia));
      setNewMode(false);
    }
  }, [code, master]);

  // --- 親子プルダウン ---
  const makerOptions = useMemo(
    () => uniq(master.map((r) => r.maker)),
    [master]
  );

  const modelOptions = useMemo(
    () => uniq(master.filter((r) => r.maker === maker).map((r) => r.model)),
    [master, maker]
  );

  const diaOptions = useMemo(
    () =>
      uniq(
        master
          .filter((r) => r.maker === maker && r.model === model)
          .map((r) => String(r.dia))
      ).sort((a, b) => Number(a) - Number(b)),
    [master, maker, model]
  );

  // --- 送信 ---
  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!location || !qty) {
      setMsg("❌ 必須項目が未入力です");
      return;
    }

    if (!code && (!maker || !model || dia === "")) {
      setMsg("❌ コード または メーカー・型式・線径が必要です");
      return;
    }

    setSending(true);

    try {
      const payload = {
        action: "submit",
        code,
        maker,
        model,
        dia: dia === "" ? "" : Number(dia),
        location,
        qty: Number(qty),
        hon,
        note,
      };

      const res = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "送信失敗");

      await fetchMaster();

      // リセット
      setCode("");
      setMaker("");
      setModel("");
      setDia("");
      setLocation("");
      setQty("");
      setHon("");
      setNote("");
      setNewMode(false);

      setMsg("✅ 送信完了");
    } catch (e2) {
      setMsg(`❌ ${e2.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
      <h2>SFT 送信フォーム</h2>
      <p>マスタ件数：{master.length}</p>

      {msg && <div style={{ marginBottom: 12 }}>{msg}</div>}

      <form onSubmit={onSubmit}>
        <label>コード</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} />

        <div>
          <input
            type="checkbox"
            checked={newMode}
            onChange={(e) => setNewMode(e.target.checked)}
          />
          マスタに無い種類を入力（新規）
        </div>

        <label>メーカー（必須）</label>
        {newMode ? (
          <input value={maker} onChange={(e) => setMaker(e.target.value)} />
        ) : (
          <select value={maker} onChange={(e) => setMaker(e.target.value)}>
            <option value="">選択</option>
            {makerOptions.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}

        <label>型式（必須）</label>
        {newMode ? (
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        ) : (
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">選択</option>
            {modelOptions.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}

        <label>線径（必須・数値）</label>
        {newMode ? (
          <input value={dia} onChange={(e) => setDia(e.target.value)} />
        ) : (
          <select value={dia} onChange={(e) => setDia(e.target.value)}>
            <option value="">選択</option>
            {diaOptions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        )}

        <label>保管場所（必須）</label>
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">選択</option>
          <option value="現場在庫">現場在庫</option>
          <option value="倉庫在庫">倉庫在庫</option>
        </select>

        <label>数量（必須）</label>
        <input value={qty} onChange={(e) => setQty(e.target.value)} />

        <label>本数（任意）</label>
        <input value={hon} onChange={(e) => setHon(e.target.value)} />

        <label>備考（任意）</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />

        <button type="submit" disabled={sending}>
          {sending ? "送信中..." : "送信"}
        </button>
      </form>
    </div>
  );
}
