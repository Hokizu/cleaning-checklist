(() => {
  "use strict";

  const STORAGE_KEY = "cleaning-checklist-ipad-v1";
  const MAX_HISTORY = 10;
  const DEFAULT_NAMES = ["田中", "佐藤", "鈴木"];
  const ITEMS = [
    "机・椅子　拭き掃除（一般席）",
    "机・椅子　拭き掃除（幼児席）",
    "トイレ",
    "下駄箱",
    "本棚整頓",
    "トイレ床・ドア",
    "入口・裏口ハンドル",
    "待合室　椅子・床　拭き掃除",
    "洗面所"
  ];

  const state = loadState();
  let currentPageIndex = 0;
  let selectionItemIndex = null;
  let confirmAction = null;
  let editingNameIndex = null;
  let toastTimer = null;
  let gestureStart = null;

  const elements = {
    sheetArea: document.querySelector("#sheetArea"),
    sheetTitle: document.querySelector("#sheetTitle"),
    sheetState: document.querySelector("#sheetState"),
    cleaningGrid: document.querySelector("#cleaningGrid"),
    displayDate: document.querySelector("#displayDate"),
    displayWeekday: document.querySelector("#displayWeekday"),
    historyPosition: document.querySelector("#historyPosition"),
    historyStatus: document.querySelector("#historyStatus"),
    olderButton: document.querySelector("#olderButton"),
    newerButton: document.querySelector("#newerButton"),
    nameCount: document.querySelector("#nameCount"),
    storageStatus: document.querySelector("#storageStatus"),
    assignmentModal: document.querySelector("#assignmentModal"),
    assignmentModalTitle: document.querySelector("#assignmentModalTitle"),
    assignmentOptions: document.querySelector("#assignmentOptions"),
    nameModal: document.querySelector("#nameModal"),
    nameForm: document.querySelector("#nameForm"),
    newNameInput: document.querySelector("#newNameInput"),
    nameFormError: document.querySelector("#nameFormError"),
    manageModal: document.querySelector("#manageModal"),
    manageNamesList: document.querySelector("#manageNamesList"),
    emptyNamesState: document.querySelector("#emptyNamesState"),
    confirmModal: document.querySelector("#confirmModal"),
    confirmModalTitle: document.querySelector("#confirmModalTitle"),
    confirmModalMessage: document.querySelector("#confirmModalMessage"),
    confirmCancelButton: document.querySelector("#confirmCancelButton"),
    confirmOkButton: document.querySelector("#confirmOkButton"),
    toast: document.querySelector("#toast")
  };

  function blankAssignments() {
    return Array.from({ length: ITEMS.length }, () => null);
  }

  function createInitialState() {
    return {
      names: [...DEFAULT_NAMES],
      histories: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createInitialState();
      }
      const parsed = JSON.parse(raw);
      const names = Array.isArray(parsed.names)
        ? parsed.names.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
        : [];
      const histories = Array.isArray(parsed.histories)
        ? parsed.histories
            .filter((record) => record && typeof record.date === "string" && Array.isArray(record.assignments))
            .map((record) => ({
              date: record.date,
              assignments: Array.from({ length: ITEMS.length }, (_, index) => {
                const value = record.assignments[index];
                return typeof value === "string" && value.trim() ? value : null;
              })
            }))
            .filter((record) => record.assignments.some(Boolean))
        : [];
      return {
        names: [...new Set(names)],
        histories: dedupeAndSortHistories(histories).slice(0, MAX_HISTORY)
      };
    } catch (error) {
      console.warn("保存データの読み込みに失敗しました", error);
      return createInitialState();
    }
  }

  function dedupeAndSortHistories(histories) {
    const byDate = new Map();
    histories.forEach((record) => byDate.set(record.date, record));
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      elements.storageStatus.textContent = "この端末に保存";
    } catch (error) {
      elements.storageStatus.textContent = "保存できません";
      showToast("端末への保存に失敗しました");
      console.error(error);
    }
  }

  function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return `${year}年${month}月${day}日`;
  }

  function formatWeekday(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long" }).format(new Date(year, month - 1, day));
    return weekday;
  }

  function getTodayKey() {
    return getDateKey();
  }

  function hasAssignments(assignments) {
    return assignments.some((value) => typeof value === "string" && value.trim());
  }

  function getPages() {
    const today = getTodayKey();
    const todayRecord = state.histories.find((record) => record.date === today);
    const todayPage = {
      date: today,
      assignments: todayRecord ? [...todayRecord.assignments] : blankAssignments(),
      isToday: true,
      isSaved: Boolean(todayRecord)
    };
    const olderPages = state.histories
      .filter((record) => record.date !== today)
      .map((record) => ({
        date: record.date,
        assignments: [...record.assignments],
        isToday: false,
        isSaved: true
      }));
    return [todayPage, ...olderPages];
  }

  function getCurrentPage() {
    const pages = getPages();
    if (!pages[currentPageIndex]) {
      currentPageIndex = 0;
    }
    return pages[currentPageIndex] || {
      date: getTodayKey(),
      assignments: blankAssignments(),
      isToday: true,
      isSaved: false
    };
  }

  function findPageIndex(date) {
    return getPages().findIndex((page) => page.date === date);
  }

  function render() {
    const pages = getPages();
    currentPageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
    const page = pages[currentPageIndex];
    const historyCount = state.histories.length;
    const historyIndex = state.histories.findIndex((record) => record.date === page.date);

    elements.sheetTitle.textContent = page.isToday ? "清掃担当者チェックリスト" : "清掃記録の確認";
    elements.sheetState.textContent = page.isToday
      ? (page.isSaved ? "今日の記録" : "今日の入力")
      : "保存済みの履歴";
    elements.sheetState.classList.toggle("history-state", !page.isToday);
    elements.displayDate.textContent = formatDate(page.date);
    elements.displayWeekday.textContent = page.isToday ? `今日・${formatWeekday(page.date)}` : formatWeekday(page.date);

    if (page.isToday && !page.isSaved) {
      elements.historyPosition.textContent = "今日";
      elements.historyStatus.textContent = historyCount ? `未保存の入力ページ ／ 履歴 ${historyCount}件` : "未保存の入力ページ";
    } else {
      elements.historyPosition.textContent = `${historyIndex + 1} / ${historyCount}`;
      elements.historyStatus.textContent = page.isToday ? "今日の最新記録" : "保存済みの記録";
    }

    elements.nameCount.textContent = `${state.names.length}名`;
    elements.olderButton.disabled = currentPageIndex >= pages.length - 1;
    elements.newerButton.disabled = currentPageIndex <= 0;
    elements.cleaningGrid.replaceChildren(...ITEMS.map((item, index) => createCleaningCard(item, index, page.assignments[index])));
  }

  function createCleaningCard(item, index, assignee) {
    const card = document.createElement("article");
    card.className = "cleaning-card";

    const heading = document.createElement("div");
    heading.className = "item-heading";

    const number = document.createElement("span");
    number.className = "item-number";
    number.textContent = String(index + 1);
    number.setAttribute("aria-hidden", "true");

    const title = document.createElement("h2");
    title.className = "item-title";
    title.textContent = item;
    heading.append(number, title);

    const label = document.createElement("p");
    label.className = "assignee-label";
    label.textContent = "担当者";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `assignee-button ${assignee ? "selected" : "unselected"}`;
    button.setAttribute("aria-label", `${item}の担当者を${assignee || "未選択"}から変更`);
    button.addEventListener("click", () => openAssignmentModal(index));

    const value = document.createElement("span");
    value.className = "assignee-value";
    value.textContent = assignee || "未選択";
    const mark = document.createElement("span");
    mark.className = "assignee-mark";
    mark.textContent = assignee ? "✓" : "＋";
    mark.setAttribute("aria-hidden", "true");
    button.append(value, mark);

    card.append(heading, label, button);
    return card;
  }

  function openAssignmentModal(itemIndex) {
    selectionItemIndex = itemIndex;
    const page = getCurrentPage();
    const currentValue = page.assignments[itemIndex];
    elements.assignmentModalTitle.textContent = ITEMS[itemIndex];
    elements.assignmentOptions.replaceChildren();

    const unassigned = createOptionButton("未選択", null, currentValue === null);
    unassigned.classList.add("unassigned-option");
    elements.assignmentOptions.append(unassigned);

    const names = [...state.names];
    if (currentValue && !names.includes(currentValue)) {
      names.unshift(currentValue);
    }
    names.forEach((name) => {
      const isLegacy = !state.names.includes(name);
      const option = createOptionButton(isLegacy ? `${name}（登録解除済み）` : name, name, currentValue === name);
      if (isLegacy) {
        option.title = "この記録に残っている名前です。名前一覧からは削除されています。";
      }
      elements.assignmentOptions.append(option);
    });
    openModal(elements.assignmentModal);
  }

  function createOptionButton(label, value, isCurrent) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-button${isCurrent ? " current" : ""}`;
    button.dataset.value = value === null ? "" : value;
    button.dataset.clear = value === null ? "true" : "false";
    button.setAttribute("aria-pressed", isCurrent ? "true" : "false");

    const text = document.createElement("span");
    text.textContent = label;
    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = isCurrent ? "✓" : "";
    check.setAttribute("aria-hidden", "true");
    button.append(text, check);
    return button;
  }

  function selectAssignment(value) {
    if (selectionItemIndex === null) return;
    const page = getCurrentPage();
    const date = page.date;
    const assignments = [...page.assignments];
    assignments[selectionItemIndex] = value || null;
    updateRecord(date, assignments);
    selectionItemIndex = null;
    closeModal(elements.assignmentModal);
    showToast(assignments.some(Boolean) ? "自動保存しました" : "今日の記録を履歴から削除しました");
  }

  function updateRecord(date, assignments) {
    const currentDateIndex = findPageIndex(date);
    if (hasAssignments(assignments)) {
      const existingIndex = state.histories.findIndex((record) => record.date === date);
      const record = { date, assignments: [...assignments] };
      if (existingIndex >= 0) {
        state.histories[existingIndex] = record;
      } else {
        state.histories.push(record);
      }
      state.histories = dedupeAndSortHistories(state.histories).slice(0, MAX_HISTORY);
    } else {
      state.histories = state.histories.filter((record) => record.date !== date);
    }
    saveState();
    const newIndex = findPageIndex(date);
    currentPageIndex = newIndex >= 0 ? newIndex : Math.max(0, currentDateIndex === -1 ? 0 : currentPageIndex);
    render();
  }

  function moveHistory(delta) {
    const pages = getPages();
    const nextIndex = Math.max(0, Math.min(currentPageIndex + delta, pages.length - 1));
    if (nextIndex === currentPageIndex) return;
    currentPageIndex = nextIndex;
    render();
    animateSheet(delta > 0 ? "old" : "new");
  }

  function animateSheet(direction) {
    elements.sheetArea.classList.remove("slide-old", "slide-new");
    void elements.sheetArea.offsetWidth;
    elements.sheetArea.classList.add(direction === "old" ? "slide-old" : "slide-new");
  }

  function openNameModal() {
    elements.nameForm.reset();
    hideNameError();
    openModal(elements.nameModal);
    window.setTimeout(() => elements.newNameInput.focus(), 80);
  }

  function openManageModal() {
    editingNameIndex = null;
    renderManageNames();
    openModal(elements.manageModal);
  }

  function renderManageNames() {
    elements.manageNamesList.replaceChildren();
    elements.emptyNamesState.hidden = state.names.length > 0;
    state.names.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "manage-row";

      if (editingNameIndex === index) {
        const input = document.createElement("input");
        input.className = "manage-name-input";
        input.type = "text";
        input.maxLength = 20;
        input.value = name;
        input.dataset.editInput = String(index);
        input.setAttribute("aria-label", `${name}を変更`);

        const saveButton = createSmallAction("保存", "save-name", index);
        const cancelButton = createSmallAction("取消", "cancel-name", index);
        row.append(input, saveButton, cancelButton);
        elements.manageNamesList.append(row);
        window.setTimeout(() => {
          input.focus();
          input.select();
        }, 50);
        return;
      }

      const nameLabel = document.createElement("span");
      nameLabel.className = "manage-name";
      nameLabel.textContent = name;
      const editButton = createSmallAction("名前変更", "edit-name", index);
      const deleteButton = createSmallAction("削除", "delete-name", index);
      deleteButton.classList.add("delete-name");
      row.append(nameLabel, editButton, deleteButton);
      elements.manageNamesList.append(row);
    });
  }

  function createSmallAction(label, action, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "small-action";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.index = String(index);
    return button;
  }

  function submitName() {
    const name = elements.newNameInput.value.trim();
    if (!name) {
      showNameError("名前を入力してください。");
      elements.newNameInput.focus();
      return;
    }
    if (state.names.includes(name)) {
      showNameError("同じ名前は登録できません。");
      elements.newNameInput.focus();
      return;
    }
    state.names.push(name);
    saveState();
    closeModal(elements.nameModal);
    render();
    showToast(`${name}さんを登録しました`);
  }

  function showNameError(message) {
    elements.nameFormError.hidden = false;
    elements.nameFormError.textContent = message;
  }

  function hideNameError() {
    elements.nameFormError.hidden = true;
    elements.nameFormError.textContent = "";
  }

  function beginEditName(index) {
    editingNameIndex = index;
    renderManageNames();
  }

  function saveEditedName(index) {
    const input = elements.manageNamesList.querySelector(`[data-edit-input="${index}"]`);
    const nextName = input ? input.value.trim() : "";
    if (!nextName) {
      showToast("名前を入力してください");
      return;
    }
    if (state.names.some((name, nameIndex) => nameIndex !== index && name === nextName)) {
      showToast("同じ名前は登録できません");
      return;
    }
    const previousName = state.names[index];
    state.names[index] = nextName;
    editingNameIndex = null;
    saveState();
    renderManageNames();
    render();
    showToast(`${previousName}さんを${nextName}さんに変更しました（過去の記録はそのままです）`);
  }

  function requestDeleteName(index) {
    const name = state.names[index];
    openConfirm(
      "名前を削除しますか？",
      `${name}さんを登録名簿から削除します。過去の記録に残る名前は変更されません。`,
      "削除する",
      () => {
        state.names.splice(index, 1);
        editingNameIndex = null;
        saveState();
        renderManageNames();
        render();
        showToast(`${name}さんを削除しました`);
      }
    );
  }

  function requestClearAllData() {
    openConfirm(
      "端末データを全消去しますか？",
      "登録した名前と、保存済みの清掃履歴をすべて削除します。この操作は元に戻せません。",
      "全消去する",
      () => {
        state.names = [];
        state.histories = [];
        currentPageIndex = 0;
        saveState();
        render();
        showToast("端末内の名前と履歴を削除しました");
      }
    );
  }

  function openConfirm(title, message, okLabel, action) {
    elements.confirmModalTitle.textContent = title;
    elements.confirmModalMessage.textContent = message;
    elements.confirmOkButton.textContent = okLabel;
    confirmAction = action;
    openModal(elements.confirmModal);
  }

  function executeConfirm() {
    const action = confirmAction;
    confirmAction = null;
    closeModal(elements.confirmModal);
    if (action) action();
  }

  function openModal(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    modal.hidden = true;
    if ([elements.assignmentModal, elements.nameModal, elements.manageModal, elements.confirmModal].every((item) => item.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  function closeAllModals() {
    [elements.assignmentModal, elements.nameModal, elements.manageModal, elements.confirmModal].forEach((modal) => closeModal(modal));
    selectionItemIndex = null;
    confirmAction = null;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
  }

  elements.assignmentOptions.addEventListener("click", (event) => {
    const button = event.target.closest(".option-button");
    if (!button) return;
    selectAssignment(button.dataset.clear === "true" ? null : button.dataset.value);
  });

  elements.nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitName();
  });

  elements.manageNamesList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    switch (button.dataset.action) {
      case "edit-name":
        beginEditName(index);
        break;
      case "cancel-name":
        editingNameIndex = null;
        renderManageNames();
        break;
      case "save-name":
        saveEditedName(index);
        break;
      case "delete-name":
        requestDeleteName(index);
        break;
      default:
        break;
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal-backdrop");
      if (modal) closeModal(modal);
    });
  });

  [elements.assignmentModal, elements.nameModal, elements.manageModal, elements.confirmModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        if (modal === elements.confirmModal) confirmAction = null;
        closeModal(modal);
      }
    });
  });

  document.querySelector("#addNameButton").addEventListener("click", openNameModal);
  document.querySelector("#manageNamesButton").addEventListener("click", openManageModal);
  document.querySelector("#clearAllDataButton").addEventListener("click", requestClearAllData);
  elements.olderButton.addEventListener("click", () => moveHistory(1));
  elements.newerButton.addEventListener("click", () => moveHistory(-1));
  elements.confirmCancelButton.addEventListener("click", () => {
    confirmAction = null;
    closeModal(elements.confirmModal);
  });
  elements.confirmOkButton.addEventListener("click", executeConfirm);

  elements.sheetArea.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    gestureStart = { x: event.clientX, y: event.clientY };
  });

  elements.sheetArea.addEventListener("pointerup", (event) => {
    if (!gestureStart || event.pointerType === "mouse") return;
    const dx = event.clientX - gestureStart.x;
    const dy = event.clientY - gestureStart.y;
    gestureStart = null;
    if (Math.abs(dy) < 65 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
    moveHistory(dy < 0 ? 1 : -1);
  });

  elements.sheetArea.addEventListener("pointercancel", () => {
    gestureStart = null;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      return;
    }
    if (!elements.assignmentModal.hidden || !elements.nameModal.hidden || !elements.manageModal.hidden || !elements.confirmModal.hidden) {
      return;
    }
    if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "ArrowUp") moveHistory(1);
    if (event.key === "ArrowDown") moveHistory(-1);
  });

  render();

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("Service Workerの登録に失敗しました", error);
      });
    });
  }
})();
