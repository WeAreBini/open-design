(() => {
  // We Are Bini change. Apache License 2.0.
  // Improve Prompt client: calls POST /api/bini/improve-prompt (Grok on volume).
  // Shows honest in-progress stages while the request is alive.
  const BUTTON_CLASS = "bini-improve-prompt";
  const ROOT_CLASS = "bini-improve-root";
  const STATUS_CLASS = "bini-improve-status";
  const TYPE_BELOW = "I will type it below";
  const MAX_QUESTION_ROUNDS = 3;
  const STAGE = {
    starting: "Starting Improve Prompt…",
    clarifying: "Asking a clarifying question…",
    writing: "Writing the brief…",
  };

  /** @type {WeakMap<HTMLElement, { status: HTMLElement, timer: number | null, startedAt: number, inFlight: boolean }>} */
  const uiByButton = new WeakMap();

  function editorText(editor) {
    return (editor.innerText || editor.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function matchesEditor(editor, text) {
    const want = text.trim();
    return editorText(editor) === want || (editor.textContent || "").trim() === want;
  }

  function findLexicalEditor(node) {
    let el = node;
    for (let depth = 0; depth < 10 && el; depth += 1) {
      if (el.__lexicalEditor) return el.__lexicalEditor;
      el = el.parentElement;
    }
    const nested = node.querySelector?.("[contenteditable='true']");
    return nested?.__lexicalEditor || null;
  }

  function setLexicalText(lexical, text) {
    const lines = String(text).split(/\n/);
    const children = lines.map((line) => ({
      children: line
        ? [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: line,
              type: "text",
              version: 1,
            },
          ]
        : [],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "paragraph",
      version: 1,
    }));
    const serialized = {
      root: {
        children: children.length
          ? children
          : [{ children: [], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1 }],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    };
    try {
      lexical.setEditorState(lexical.parseEditorState(JSON.stringify(serialized)));
      return true;
    } catch {
      return false;
    }
  }

  function pasteIntoEditor(editor, text) {
    try {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      const paste = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      });
      editor.dispatchEvent(paste);
      return paste.defaultPrevented || matchesEditor(editor, text);
    } catch {
      return false;
    }
  }

  function syncSiblingFields(editor, text) {
    const shell = editor.closest(".composer-input-editor") || editor.parentElement;
    if (!shell) return;
    for (const field of shell.querySelectorAll("textarea, input[type=text], input[type=hidden]")) {
      if (field === editor) continue;
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function replaceEditorText(editor, text) {
    editor.focus();
    const lexical = findLexicalEditor(editor);
    if (lexical && setLexicalText(lexical, text)) {
      syncSiblingFields(editor, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return matchesEditor(editor, text) || true;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    const beforeTypes = ["insertReplacementText", "insertFromPaste", "insertText"];
    for (const inputType of beforeTypes) {
      const before = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType,
        data: text,
      });
      const handled = !editor.dispatchEvent(before) || before.defaultPrevented;
      if (handled && matchesEditor(editor, text)) {
        syncSiblingFields(editor, text);
        return true;
      }
    }

    if (pasteIntoEditor(editor, text) && matchesEditor(editor, text)) {
      syncSiblingFields(editor, text);
      return true;
    }

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      editor.textContent = text;
    }

    editor.dispatchEvent(
      new InputEvent("input", { bubbles: true, cancelable: false, inputType: "insertFromPaste", data: text }),
    );
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    syncSiblingFields(editor, text);
    return matchesEditor(editor, text);
  }

  function formatElapsed(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
  }

  function ensureUi(button) {
    let ui = uiByButton.get(button);
    if (ui) return ui;
    const status = document.createElement("div");
    status.className = STATUS_CLASS;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    status.hidden = true;
    const pulse = document.createElement("span");
    pulse.className = "bini-improve-status-pulse";
    pulse.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "bini-improve-status-label";
    const elapsed = document.createElement("span");
    elapsed.className = "bini-improve-status-elapsed";
    status.appendChild(pulse);
    status.appendChild(label);
    status.appendChild(elapsed);
    button.insertAdjacentElement("afterend", status);
    ui = { status, timer: null, startedAt: 0, inFlight: false, label, elapsed };
    uiByButton.set(button, ui);
    return ui;
  }

  function setProgress(button, stage) {
    const ui = ensureUi(button);
    ui.status.hidden = false;
    ui.status.dataset.stage = stage;
    ui.label.textContent = stage;
    if (!ui.startedAt) ui.startedAt = Date.now();
    ui.elapsed.textContent = ` · ${formatElapsed(Date.now() - ui.startedAt)}`;
    if (ui.timer == null) {
      ui.timer = window.setInterval(() => {
        if (!ui.startedAt || ui.status.hidden) return;
        ui.elapsed.textContent = ` · ${formatElapsed(Date.now() - ui.startedAt)}`;
      }, 1000);
    }
    button.setAttribute("aria-busy", "true");
    button.textContent = "Improve prompt";
  }

  function clearProgress(button) {
    const ui = uiByButton.get(button);
    if (!ui) return;
    if (ui.timer != null) {
      window.clearInterval(ui.timer);
      ui.timer = null;
    }
    ui.startedAt = 0;
    ui.status.hidden = true;
    ui.status.removeAttribute("data-stage");
    ui.label.textContent = "";
    ui.elapsed.textContent = "";
    button.removeAttribute("aria-busy");
  }

  function dialog(question, onDone) {
    const root = document.createElement("div");
    root.className = ROOT_CLASS;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "bini-improve-title");

    const card = document.createElement("form");
    card.className = "bini-improve-card";

    const title = document.createElement("h2");
    title.id = "bini-improve-title";
    title.textContent = question.prompt;
    card.appendChild(title);

    if (question.reason) {
      const reason = document.createElement("p");
      reason.className = "bini-improve-reason";
      reason.textContent = String(question.reason);
      card.appendChild(reason);
    }

    const note = document.createElement("p");
    note.className = "bini-improve-note";
    note.textContent =
      "One fact is still missing from this brief. Pick an option or type a short answer. Nothing else is invented.";
    card.appendChild(note);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "bini-improve-options";
    const legend = document.createElement("legend");
    legend.textContent = "Choose one";
    fieldset.appendChild(legend);

    const custom = document.createElement("input");
    custom.type = "text";
    custom.className = "bini-improve-custom";
    custom.id = "bini-improve-custom";
    custom.placeholder = "Type a short answer";
    custom.maxLength = 200;
    custom.setAttribute("aria-label", "Custom answer");

    for (const [index, option] of question.options.entries()) {
      const row = document.createElement("div");
      row.className = "bini-improve-option";
      // OD ships `.modal label { flex-direction: column }`. Keep option rows
      // as div+span with inline layout so that rule cannot stack the control.
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("flex-direction", "row", "important");
      row.style.setProperty("flex-wrap", "nowrap", "important");
      row.style.setProperty("align-items", "flex-start", "important");
      row.style.setProperty("justify-content", "flex-start", "important");
      row.style.setProperty("gap", "10px", "important");
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("box-sizing", "border-box", "important");
      const inputId = `bini-answer-${index}`;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "bini-answer";
      input.id = inputId;
      input.value = option;
      input.style.setProperty("flex", "0 0 16px", "important");
      input.style.setProperty("width", "16px", "important");
      input.style.setProperty("height", "16px", "important");
      input.style.setProperty("max-width", "16px", "important");
      input.style.setProperty("min-width", "16px", "important");
      input.style.setProperty("margin", "3px 0 0", "important");
      input.style.setProperty("position", "static", "important");
      input.style.setProperty("align-self", "flex-start", "important");
      if (index === 0) input.checked = true;
      input.addEventListener("change", () => {
        if (option === TYPE_BELOW) custom.focus();
      });
      const text = document.createElement("span");
      text.className = "bini-improve-option-text";
      text.id = `${inputId}-text`;
      text.textContent = option;
      text.style.setProperty("display", "block", "important");
      text.style.setProperty("flex", "1 1 auto", "important");
      text.style.setProperty("margin", "0", "important");
      text.style.setProperty("padding", "0", "important");
      text.style.setProperty("line-height", "1.4", "important");
      text.style.setProperty("position", "static", "important");
      text.style.setProperty("text-align", "left", "important");
      text.style.setProperty("min-width", "0", "important");
      text.style.setProperty("width", "auto", "important");
      text.style.setProperty("max-width", "none", "important");
      input.setAttribute("aria-labelledby", text.id);
      row.appendChild(input);
      row.appendChild(text);
      row.addEventListener("click", (event) => {
        if (event.target === input) return;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      fieldset.appendChild(row);
    }
    card.appendChild(fieldset);

    const customWrap = document.createElement("div");
    customWrap.className = "bini-improve-custom-wrap";
    const customLabel = document.createElement("div");
    customLabel.className = "bini-improve-custom-label";
    customLabel.id = "bini-improve-custom-label";
    customLabel.textContent = "Or write your own";
    custom.setAttribute("aria-labelledby", "bini-improve-custom-label");
    customWrap.appendChild(customLabel);
    customWrap.appendChild(custom);
    card.appendChild(customWrap);

    const actions = document.createElement("div");
    actions.className = "bini-improve-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "bini-improve-secondary";
    cancel.textContent = "Cancel";
    const use = document.createElement("button");
    use.type = "submit";
    use.className = "bini-improve-primary";
    use.textContent = "Use this answer";
    actions.appendChild(cancel);
    actions.appendChild(use);
    card.appendChild(actions);

    root.appendChild(card);
    document.body.appendChild(root);
    custom.focus();

    function close(value) {
      root.remove();
      onDone(value);
    }

    cancel.addEventListener("click", () => {
      close(null);
    });
    root.addEventListener("click", (event) => {
      if (event.target === root) close(null);
    });
    card.addEventListener("submit", (event) => {
      event.preventDefault();
      const picked = card.querySelector("input[name=bini-answer]:checked");
      const typed = custom.value.trim();
      const pickedValue = picked ? picked.value : "";
      if (pickedValue === TYPE_BELOW && !typed) {
        custom.focus();
        custom.setAttribute("aria-invalid", "true");
        return;
      }
      const value = typed || (pickedValue === TYPE_BELOW ? "" : pickedValue);
      close(value ? { [question.id]: value } : null);
    });
  }

  function askQuestion(question) {
    return new Promise((resolve) => {
      dialog(question, resolve);
    });
  }

  function post(prompt, answers) {
    return fetch("/api/bini/improve-prompt", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, answers: answers || {} }),
    }).then((response) =>
      response.json().then((body) => {
        const message = body?.error?.message ? body.error.message : "Could not improve this prompt.";
        if (!response.ok) throw new Error(message);
        return body;
      }),
    );
  }

  function applyImproved(editor, button, body) {
    if (!body?.prompt) {
      clearProgress(button);
      button.textContent = "No change returned";
      window.setTimeout(() => {
        button.textContent = "Improve prompt";
      }, 2000);
      return;
    }
    const ok = replaceEditorText(editor, body.prompt);
    clearProgress(button);
    button.textContent = ok ? "Prompt updated" : "Updated — check the composer";
    window.setTimeout(() => {
      button.textContent = "Improve prompt";
    }, 1800);
  }

  async function askThenImprove(editor, button, prompt, initialAnswers) {
    let answers = { ...(initialAnswers || {}) };
    for (let round = 0; round < MAX_QUESTION_ROUNDS; round += 1) {
      // Answers are already known; Grok may ask again or write the brief.
      setProgress(button, STAGE.writing);
      const body = await post(prompt, answers);
      if (body.status === "questions" && body.questions?.[0]) {
        clearProgress(button);
        button.disabled = false;
        button.removeAttribute("aria-busy");
        const next = await askQuestion(body.questions[0]);
        if (!next) return null;
        button.disabled = true;
        answers = { ...answers, ...next };
        continue;
      }
      return body;
    }
    setProgress(button, STAGE.writing);
    return post(prompt, answers);
  }

  async function run(editor, button) {
    const ui = ensureUi(button);
    if (ui.inFlight) return;
    const prompt = editorText(editor);
    if (prompt.length < 3) {
      button.textContent = "Write a prompt first";
      window.setTimeout(() => {
        button.textContent = "Improve prompt";
      }, 1600);
      return;
    }
    ui.inFlight = true;
    button.disabled = true;
    setProgress(button, STAGE.starting);
    try {
      // First call may return clarifying questions or the finished brief.
      setProgress(button, STAGE.clarifying);
      const body = await post(prompt, {});
      if (body.status === "questions" && body.questions?.[0]) {
        clearProgress(button);
        button.disabled = false;
        button.removeAttribute("aria-busy");
        const firstAnswers = await askQuestion(body.questions[0]);
        if (!firstAnswers) return;
        button.disabled = true;
        const finalBody = await askThenImprove(editor, button, prompt, firstAnswers);
        if (!finalBody) return;
        applyImproved(editor, button, finalBody);
        return;
      }
      setProgress(button, STAGE.writing);
      applyImproved(editor, button, body);
    } catch (error) {
      clearProgress(button);
      button.textContent = error instanceof Error ? error.message : String(error);
      window.setTimeout(() => {
        button.textContent = "Improve prompt";
      }, 2400);
    } finally {
      ui.inFlight = false;
      button.disabled = false;
    }
  }

  function attach(editor) {
    if (!editor || editor.dataset.biniImprove === "1") return;
    const parent = editor.parentElement;
    if (!parent || parent.querySelector(`.${BUTTON_CLASS}`)) return;
    editor.dataset.biniImprove = "1";
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "Improve prompt";
    button.setAttribute("aria-label", "Improve prompt");
    button.addEventListener("click", () => {
      void run(editor, button);
    });
    parent.appendChild(button);
  }

  function scan() {
    for (const editor of document.querySelectorAll(".composer-editable")) attach(editor);
  }

  const style = document.createElement("style");
  style.setAttribute("data-bini-improve-progress", "1");
  style.textContent = [
    ".bini-improve-prompt{margin:8px 0 0;border:1px solid var(--border);background:var(--bg-subtle);color:var(--text);border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer}",
    ".bini-improve-prompt:disabled{opacity:.6;cursor:progress}",
    ".bini-improve-prompt[aria-busy=true]{cursor:progress}",
    `.${STATUS_CLASS}{display:flex;align-items:center;gap:8px;margin:6px 0 0;min-height:1.25rem;font-size:.85rem;line-height:1.35;color:var(--text-muted,#666)}`,
    `.${STATUS_CLASS}[hidden]{display:none !important}`,
    ".bini-improve-status-pulse{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:var(--accent,#3BBF7D);box-shadow:0 0 0 0 color-mix(in srgb,var(--accent,#3BBF7D) 55%,transparent);animation:bini-improve-pulse 1.4s cubic-bezier(0.23,1,0.32,1) infinite}",
    "@keyframes bini-improve-pulse{0%{transform:scale(0.92);box-shadow:0 0 0 0 color-mix(in srgb,var(--accent,#3BBF7D) 45%,transparent)}70%{transform:scale(1);box-shadow:0 0 0 8px transparent}100%{transform:scale(0.92);box-shadow:0 0 0 0 transparent}}",
    "@media (prefers-reduced-motion:reduce){.bini-improve-status-pulse{animation:none}}",
    ".bini-improve-status-label{flex:0 1 auto;min-width:0}",
    ".bini-improve-status-elapsed{flex:0 0 auto;opacity:.85;font-variant-numeric:tabular-nums}",
    ".bini-improve-root{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:4000;padding:24px}",
    ".bini-improve-card{width:min(440px,100%);background:var(--bg-panel,#fff);color:var(--text,#111);border:1px solid var(--border,#d0d0d0);border-radius:14px;padding:18px 18px 16px;display:flex;flex-direction:column;gap:14px;box-shadow:0 18px 48px rgba(0,0,0,.28)}",
    ".bini-improve-card h2{margin:0;font-size:1.05rem;line-height:1.35;font-weight:600;color:var(--text-strong,var(--text,#111))}",
    ".bini-improve-reason{margin:0;font-size:.9rem;line-height:1.45;color:var(--text,#333)}",
    ".bini-improve-note{margin:0;font-size:.9rem;line-height:1.45;color:var(--text-muted,#666)}",
    ".bini-improve-root .bini-improve-options{margin:0;padding:0;border:0;display:flex;flex-direction:column;gap:8px}",
    ".bini-improve-root .bini-improve-options legend{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
    ".bini-improve-root .bini-improve-option{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;align-items:flex-start !important;gap:10px;margin:0;padding:10px 12px;border:1px solid var(--border,#d0d0d0);border-radius:10px;background:var(--bg,transparent);cursor:pointer}",
    ".bini-improve-root .bini-improve-option:has(input:checked){border-color:var(--border-strong,var(--accent,#333));background:var(--bg-elevated,var(--bg-subtle,#f5f5f5))}",
    ".bini-improve-root .bini-improve-option > input{margin:3px 0 0;flex:0 0 16px !important;width:16px !important;height:16px !important;max-width:16px !important;min-width:16px !important;align-self:flex-start;position:static !important}",
    ".bini-improve-root .bini-improve-option-text{display:block !important;flex:1 1 auto !important;margin:0;padding:0;line-height:1.4;font:inherit;color:inherit;cursor:pointer;text-align:left !important;min-width:0;position:static !important}",
    ".bini-improve-root .bini-improve-custom-wrap{display:flex;flex-direction:column;gap:6px}",
    ".bini-improve-root .bini-improve-custom-label{display:block !important;margin:0;font-size:.85rem;color:var(--text-muted,#666);flex-direction:unset !important}",
    ".bini-improve-root .bini-improve-custom{width:100%;box-sizing:border-box;border:1px solid var(--border,#d0d0d0);background:var(--bg,#fff);color:var(--text,#111);border-radius:10px;padding:10px 12px;font:inherit}",
    ".bini-improve-root .bini-improve-custom[aria-invalid=true]{border-color:#c0392b}",
    ".bini-improve-root .bini-improve-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}",
    ".bini-improve-root .bini-improve-actions button{font:inherit;border-radius:8px;padding:8px 12px;border:1px solid var(--border,#d0d0d0);cursor:pointer}",
    ".bini-improve-root .bini-improve-secondary{background:var(--bg-subtle,#f5f5f5);color:var(--text,#111)}",
    ".bini-improve-root .bini-improve-primary{background:var(--text-strong,#111);color:var(--bg-panel,#fff);border-color:transparent}",
    "[data-theme=dark] .bini-improve-root{background:rgba(0,0,0,.55)}",
    "[data-theme=dark] .bini-improve-root .bini-improve-primary{background:var(--text-strong,#f8f9fa);color:var(--bg-app,#2a2a2a)}",
    "[data-theme=dark] .bini-improve-status{color:var(--text-muted,#d0d3d8)}",
  ].join("");
  document.documentElement.appendChild(style);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
