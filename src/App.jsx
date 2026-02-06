import React, { useEffect, useMemo, useState } from "react";

const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL;

function uniq(arr) {
  return Array.from(new Set(arr.filter((v) => v !== "" && v !== null && v !== undefined)));
}
function byStr(a, b) {
  return String(a).localeCompare(String(b), "ja");
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function fmt2(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "";
  return round2(v).toFixed(2);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState([]);

  // 入力（必須系）
  const [code, setCode] = useState("");
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [dia, setDia] = useState(""); // 数値入力（文字列で保持→送信時にNumber化）

  const [newMode, setNewMode] = useState(false);

  const [location, setLocation] = useState("");
  const [qty, setQty] = useState("");

  // 任意
  const [hon, setHon] = useState("");   // 本数（任意）
  const [note, setNote] = useState(""); // 備考（任意）

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function fetchMaster() {
    if (!GAS_WEBAPP_URL) throw new Error("VITE_GAS_WEBAPP_URL が未設定です");
    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // コード入力で即時補完（クライアント側）
  useEffect(() => {
    const c = code.trim();
    if (!c) return;
    const hit = master.find((r) => String(r.code) === c);
    if (hit) {
      setMaker(hit.maker || "");
      setModel(hit.model || "");
      setDia(hit.dia !== null && hit.dia !== undefined ? String(hit.dia) : "");
      setNewMode(false);
      setMsg("");
    }
  }, [code, master]);

  // 親子プルダウン候補
  const makerOptions = useMemo(
    () => uniq(master.map((r) => r.maker)).sort(byStr),
    [master]
  );

  const modelOptions = useMemo(() => {
    const m = maker.trim();
    if (!m) return [];
    return uniq(master.filter((r) => r.maker === m).map((r) => r.model)).sort(byStr);
  }, [master, maker]);

  const diaOptions = useMemo(() => {
    const m = maker.trim();
    const mo = model.trim();
    if (!m || !mo) return [];
    const list = master
      .filter((r) => r.maker === m && r.model === mo)
      .map((r) => r.dia)
      .filter((v) => v !== null && v !== undefined);

    const unique = uniq(list);
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [master, maker, model]);

  // プルダウン選択からコード自動セット（既存のみ）
  useEffect(() => {
    if (newMode) return;
    const m = maker.trim();
    const mo = model.trim();
    const d = Number(dia);
    if (!m || !mo || Number.isNaN(d)) return;

    const hit = master.find(
      (r) =>
        r.maker === m &&
        r.model === mo &&
        r.dia !== null &&
        Math.abs(Number(r.dia) - d) < 1e-9
    );
    if (hit) setCode(String(hit.code));
  }, [maker, model, dia, master, newMode]);

  function resetForm() {
    setCode("");
    setMaker("");
    setModel("");
    setDia("");
    setLocation("");
    setQty("");
    setHon("");
    setNote("");
    setNewMode(false);
    setMsg("✅ 送信完了（次どうぞ）");
  }

  function validateRequired() {
    // 必須：保管場所、数量
    if (!location) return "保管場所を選択して";
    const q = Number(qty);
    if (Number.isNaN(q)) return "数量が数値じゃない";

    // 必須：コード or（メーカー・型式・線径）
    if (code.trim()) return null;

    if (!maker.trim()) return "メーカーを選択/入力して";
    if (!model.trim()) return "型式を選択/入力して";
    const d = Number(dia);
    if (Number.isNaN(d)) return "線径が数値じゃない";

    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    const err = validateRequired();
    if (err) return setMsg(`❌ ${err}`);

    if (!GAS_WEBAPP_URL) return setMsg("❌ VITE_GAS_WEBAPP_URL が未設定です");

    setSending(true);
    try {
      const payload = {
        action: "submit",
        code: code.trim() || "",
        maker: maker.trim() || "",
        model: model.trim() || "",
        dia: dia === "" ? "" : Number(dia), // 数値
        location,
        qty: Number(qty), // GAS側で小数第2位丸め
        hon: hon.trim() || "",   // 任意
        note: note.trim() || "", // 任意
      };

      const res = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "送信失敗");

      // マスタ増えてる可能性があるので更新
      await fetchMaster();
      resetForm();
    } catch (e2) {
      setMsg(`❌ ${e2.message}`);
    } finally {
      setSending(false);
    }
  }

  const disabledAll = loading || sending;

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ margin: 0 }}>SFT 送信フォーム</h2>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        {loading ? "マスタ読込中…" : `マスタ件数：${master.length}`}
      </p>

      {msg && (
        <div style={{ padding: 10, marginBottom: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <fieldset disabled={disabledAll} style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            コード（入力するとメーカー/型式/線径が自動補完）
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例: 123"
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <input
              id="newMode"
              type="checkbox"
              checked={newMode}
              onChange={(e) => setNewMode(e.target.checked)}
            />
            <label htmlFor="newMode">マスタに無い種類を入力（新規登録）</label>
          </div>

          {/* メーカー */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>メーカー（必須）</label>
          {newMode ? (
            <>
              <input
                list="makerList"
                value={maker}
                onChange={(e) => setMaker(e.target.value)}
                placeholder="候補から選ぶ or 新規入力"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
              />
              <datalist id="makerList">
                {makerOptions.map((x) => <option key={x} value={x} />)}
              </datalist>
            </>
          ) : (
            <select
              value={maker}
              onChange={(e) => { setMaker(e.target.value); setModel(""); setDia(""); setCode(""); }}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
            >
              <option value="">選択してください</option>
              {makerOptions.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}

          {/* 型式 */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>型式（必須）</label>
          {newMode ? (
            <>
              <input
                list="modelList"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="候補から選ぶ or 新規入力"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
              />
              <datalist id="modelList">
                {modelOptions.map((x) => <option key={x} value={x} />)}
              </datalist>
            </>
          ) : (
            <select
              value={model}
              onChange={(e) => { setModel(e.target.value); setDia(""); setCode(""); }}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
              disabled={!maker}
            >
              <option value="">選択してください</option>
              {modelOptions.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}

          {/* 線径 */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>線径（必須・数値）</label>
          {newMode ? (
            <input
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              inputMode="decimal"
              placeholder="例: 0.14"
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
            />
          ) : (
            <select
              value={dia}
              onChange={(e) => { setDia(e.target.value); setCode(""); }}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
              disabled={!maker || !model}
            >
              <option value="">選択してください</option>
              {diaOptions.map((x) => (
                <option key={String(x)} value={String(x)}>{String(x)}</option>
              ))}
            </select>
          )}

          {/* 保管場所 */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>保管場所（必須）</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
          >
            <option value="">選択してください</option>
            <option value="現場在庫">現場在庫</option>
            <option value="倉庫在庫">倉庫在庫</option>
          </select>

          {/* 数量 */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>数量（必須・小数第2位）</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => setQty((v) => (v === "" ? "" : fmt2(v)))}
            inputMode="decimal"
            placeholder="例: 12.34"
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
          />

          {/* 本数（任意） */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>本数（任意）</label>
          <input
            value={hon}
            onChange={(e) => setHon(e.target.value)}
            inputMode="numeric"
            placeholder="例: 25"
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
          />

          {/* 備考（任意） */}
          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>備考（任意）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: ロットNo.、注意点など"
            rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ccc", resize: "vertical" }}
          />

          <button
            type="submit"
            disabled={sending}
            style={{
              width: "100%",
              marginTop: 14,
              padding: 12,
              borderRadius: 14,
              border: "none",
              cursor: sending ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {sending ? "送信中..." : "送信"}
          </button>
        </fieldset>
      </form>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        ※ 本数・備考以外は必須。<br />
        ※ コードがあればコード優先でマスタ参照。<br />
        ※ コードなしでマスタ外の組み合わせは連番コード発行→マスタ追加→SFT保存。
      </div>
    </div>
  );
}
