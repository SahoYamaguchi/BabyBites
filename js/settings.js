import { getSettings, saveSetting } from "./api.js";

const birthDateInput = document.querySelector("#birth-date-input");
const startDateInput = document.querySelector("#start-date-input");
const absorptionRateInput = document.querySelector("#absorption-rate-input");
const saveSettingsButton = document.querySelector("#save-settings-button");
const settingsStatus = document.querySelector("#settings-status");

const DEFAULT_ABSORPTION_RATE = "10";

function showStatus(message, type = "info") {
  settingsStatus.textContent = message;
  settingsStatus.className = `status-message ${type}`;
}

async function loadSettings() {
  try {
    const data = await getSettings();
    birthDateInput.value = data.settings?.["生年月日"] || "";
    startDateInput.value = data.settings?.["開始日"] || "";
    absorptionRateInput.value = data.settings?.["鉄吸収率"] || DEFAULT_ABSORPTION_RATE;
  } catch (error) {
    console.warn(error);
    showStatus("設定の取得に失敗しました。", "error");
  }
}

saveSettingsButton.addEventListener("click", async () => {
  const birthDate = birthDateInput.value;
  const startDate = startDateInput.value;
  const absorptionRate = absorptionRateInput.value || DEFAULT_ABSORPTION_RATE;

  try {
    saveSettingsButton.disabled = true;
    showStatus("保存しています...", "info");

    if (birthDate) {
      await saveSetting("生年月日", birthDate);
    }
    if (startDate) {
      await saveSetting("開始日", startDate);
    }
    await saveSetting("鉄吸収率", absorptionRate);

    showStatus("設定を保存しました。", "success");
  } catch (error) {
    console.error(error);
    showStatus("設定の保存に失敗しました。", "error");
  } finally {
    saveSettingsButton.disabled = false;
  }
});

loadSettings();
