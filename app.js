(function (root, factory) {
  const calculator = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = calculator;
  }

  if (typeof document !== "undefined") {
    let storage;
    try {
      storage = root.localStorage;
    } catch (error) {
      storage = null;
    }
    calculator.initialize(document, storage);
  }
})(globalThis, function () {
  "use strict";

  const STORAGE_KEY = "monthline.months.v1";
  const SALARY_SETTINGS_STORAGE_KEY = "monthline.salary-settings.v1";
  const THEME_STORAGE_KEY = "monthline.theme.v1";
  const HOLIDAY_STORAGE_KEY = "monthline.holidays.v1";
  const VALID_CATEGORIES = new Set(["work", "holiday", "off", "leave"]);
  const DEFAULT_HOLIDAYS = [
    { date: "2026-01-15", name: "Pongal" },
    { date: "2026-01-16", name: "Thiruvalluvar Day" },
    { date: "2026-01-26", name: "Republic Day" },
    { date: "2026-04-14", name: "Tamil New Year" },
    { date: "2026-05-01", name: "May Day" },
    { date: "2026-09-14", name: "Vinayagar Chaturthi" },
    { date: "2026-10-02", name: "Gandhi Jayanthi" },
    { date: "2026-10-19", name: "Ayudha Pooja" },
    { date: "2026-11-09", name: "2nd Day of Deepavali" },
    { date: "2026-12-25", name: "Christmas" }
  ];
  const monthNameFormatter = new Intl.DateTimeFormat("en-IN", { month: "long" });
  const longDateFormatter = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function dateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isValidDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeHolidayList(entries) {
    if (!Array.isArray(entries)) return [];
    const holidaysByDate = new Map();
    for (const entry of entries) {
      const date = entry && String(entry.date || "").trim();
      const name = entry && String(entry.name || "").trim();
      if (isValidDateKey(date) && name && name.length <= 100) {
        holidaysByDate.set(date, { date, name });
      }
    }
    return [...holidaysByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function loadHolidayList(storage) {
    try {
      const stored = storage && storage.getItem(HOLIDAY_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      const holidays = parsed && parsed.version === 1 ? normalizeHolidayList(parsed.holidays) : [];
      if (holidays.length > 0) return holidays;
    } catch (error) {
      return normalizeHolidayList(DEFAULT_HOLIDAYS);
    }
    return normalizeHolidayList(DEFAULT_HOLIDAYS);
  }

  function holidayNameForDate(year, month, day, holidays) {
    const key = dateKey(year, month, day);
    const holiday = holidays.find((entry) => entry.date === key);
    return holiday ? holiday.name : "";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function isScheduledOff(year, month, day, workweek) {
    const weekday = new Date(year, month - 1, day).getDay();
    return weekday === 0 || (Number(workweek) === 5 && weekday === 6);
  }

  function categoryForDay(year, month, day, overrides, workweek, holidaysByDate) {
    const key = dateKey(year, month, day);
    if (holidaysByDate.has(key)) return "holiday";
    const override = overrides[String(day)];
    return override || (isScheduledOff(year, month, day, workweek) ? "off" : "work");
  }

  function calculateMonth(options) {
    const year = Number(options.year);
    const month = Number(options.month);
    const workweek = Number(options.workweek) === 6 ? 6 : 5;
    const overrides = options.overrides || {};
    const salaryText = String(options.salary ?? "").trim();
    const salaryValue = Number(salaryText);
    const salaryConfigured = salaryText !== "" && Number.isFinite(salaryValue) && salaryValue >= 0;
    const salary = salaryConfigured ? salaryValue : 0;
    const allowanceValue = Number(options.paidLeave);
    const paidLeaveAllowance = Number.isFinite(allowanceValue) ? Math.max(0, Math.floor(allowanceValue)) : 0;
    const totalDays = daysInMonth(year, month);
    const holidays = normalizeHolidayList(options.holidays === undefined ? DEFAULT_HOLIDAYS : options.holidays);
    const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
    const leaveDates = [];
    const dayRecords = [];
    let scheduledWorkingDays = 0;
    let weeklyOffs = 0;
    let governmentHolidays = 0;

    for (let day = 1; day <= totalDays; day += 1) {
      const category = categoryForDay(year, month, day, overrides, workweek, holidaysByDate);
      const automaticOff = isScheduledOff(year, month, day, workweek);
      const holidayName = holidaysByDate.get(dateKey(year, month, day)) || "";
      const isHoliday = category === "holiday";
      const isWeeklyOff = category === "off" || (isHoliday && automaticOff);
      const isWorking = category === "work" || category === "leave" || (isHoliday && !automaticOff);

      if (isHoliday) governmentHolidays += 1;
      if (isWeeklyOff) weeklyOffs += 1;
      if (isWorking && !isHoliday) scheduledWorkingDays += 1;
      if (category === "leave" && isWorking) leaveDates.push(day);

      dayRecords.push({
        day,
        category,
        automaticOff,
        holidayName,
        isHoliday,
        isWeeklyOff,
        isWorking
      });
    }

    const paidLeaveUsed = Math.min(paidLeaveAllowance, leaveDates.length);
    const paidDates = new Set(leaveDates.slice(0, paidLeaveUsed));
    const unpaidLeaveDays = leaveDates.length - paidLeaveUsed;
    const dailySalary = scheduledWorkingDays > 0 ? salary / scheduledWorkingDays : null;
    const deduction = dailySalary === null ? 0 : unpaidLeaveDays * dailySalary;
    const estimatedSalary = Math.max(0, salary - deduction);

    return {
      year,
      month,
      workweek,
      totalDays,
      scheduledWorkingDays,
      governmentHolidays,
      weeklyOffs,
      leaveDates,
      paidDates,
      leaveDays: leaveDates.length,
      paidLeaveAllowance,
      paidLeaveUsed,
      paidLeaveRemaining: Math.max(0, paidLeaveAllowance - paidLeaveUsed),
      unpaidLeaveDays,
      salary,
      salaryConfigured,
      dailySalary,
      deduction,
      estimatedSalary,
      dayRecords
    };
  }

  function emptyRecord() {
    return { workweek: 5, overrides: {}, leaveReturns: {} };
  }

  function normalizeSalarySettings(settings) {
    const salary = settings && (typeof settings.salary === "string" || typeof settings.salary === "number")
      ? String(settings.salary)
      : "";
    const allowance = Number(settings && settings.paidLeave);
    return {
      salary,
      paidLeave: Number.isFinite(allowance) ? Math.max(0, Math.floor(allowance)) : 0
    };
  }

  function loadSalarySettings(storage, records, preferredPeriod) {
    try {
      const stored = storage && storage.getItem(SALARY_SETTINGS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && parsed.version === 1 && parsed.settings && typeof parsed.settings === "object") {
        return normalizeSalarySettings(parsed.settings);
      }
    } catch (error) {
      return { salary: "", paidLeave: 0 };
    }

    const otherPeriods = Object.keys(records)
      .filter((period) => period !== preferredPeriod)
      .sort((left, right) => right.localeCompare(left));
    const candidates = [records[preferredPeriod], ...otherPeriods.map((period) => records[period])];
    const legacySettings = candidates.find((record) => {
      if (!record || typeof record !== "object") return false;
      const salary = String(record.salary ?? "").trim();
      const allowance = Number(record.paidLeave);
      return salary !== "" || (Number.isFinite(allowance) && allowance > 0);
    });

    return normalizeSalarySettings(legacySettings);
  }

  function normalizeRecord(record, year, month) {
    if (!record || typeof record !== "object") return emptyRecord();

    const normalized = emptyRecord();
    normalized.workweek = Number(record.workweek) === 6 ? 6 : 5;

    if (record.overrides && typeof record.overrides === "object") {
      const maxDay = daysInMonth(year, month);
      for (const [day, category] of Object.entries(record.overrides)) {
        const dayNumber = Number(day);
        if (Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= maxDay) {
          if (!VALID_CATEGORIES.has(category)) continue;
          if (category === "leave" && isScheduledOff(year, month, dayNumber, normalized.workweek)) continue;
          normalized.overrides[String(dayNumber)] = category;
        }
      }
    }
    if (record.leaveReturns && typeof record.leaveReturns === "object") {
      for (const [day, category] of Object.entries(record.leaveReturns)) {
        if (normalized.overrides[day] === "leave" && category === "work") {
          normalized.leaveReturns[day] = category;
        }
      }
    }

    return normalized;
  }

  function initialize(documentRef, storage) {
    const themeToggle = documentRef.getElementById("themeToggle");
    const themeToggleLabel = documentRef.getElementById("themeToggleLabel");
    const themeColorMeta = documentRef.querySelector('meta[name="theme-color"]');
    const rootElement = documentRef.documentElement;
    let currentTheme = rootElement.dataset.theme === "dark" ? "dark" : "light";

    function applyTheme(theme, save = true) {
      currentTheme = theme === "dark" ? "dark" : "light";
      rootElement.dataset.theme = currentTheme;
      const isDark = currentTheme === "dark";
      themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
      themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
      themeToggleLabel.textContent = `${isDark ? "Light" : "Dark"} mode`;
      themeColorMeta.setAttribute("content", isDark ? "#121a16" : "#f3f6f4");

      if (save && storage) {
        try {
          storage.setItem(THEME_STORAGE_KEY, currentTheme);
        } catch (error) {
          return;
        }
      }
    }

    applyTheme(currentTheme, false);
    themeToggle.addEventListener("click", () => {
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });

    const monthSelect = documentRef.getElementById("monthSelect");
    const yearInput = documentRef.getElementById("yearInput");
    const salaryInput = documentRef.getElementById("salaryInput");
    const paidLeaveInput = documentRef.getElementById("paidLeaveInput");
    const calendarGrid = documentRef.getElementById("calendarGrid");
    const resetButton = documentRef.getElementById("resetMonth");
    const resetDialog = documentRef.getElementById("resetDialog");
    const status = documentRef.getElementById("calendarStatus");
    const holidayListStatus = documentRef.getElementById("holidayListStatus");
    const holidayWorkbookFile = documentRef.getElementById("holidayWorkbookFile");
    let holidays = loadHolidayList(storage);
    const metricNodes = {
      monthlySalary: documentRef.getElementById("monthlySalaryResult"),
      calendarDays: documentRef.getElementById("calendarDaysResult"),
      workingDays: documentRef.getElementById("workingDaysResult"),
      holidays: documentRef.getElementById("governmentHolidaysResult"),
      weeklyOffs: documentRef.getElementById("weeklyOffsResult"),
      leaveDays: documentRef.getElementById("leaveDaysResult"),
      paidUsed: documentRef.getElementById("paidLeaveUsedResult"),
      paidRemaining: documentRef.getElementById("paidLeaveRemainingResult"),
      unpaidLeave: documentRef.getElementById("unpaidLeaveResult"),
      dailySalary: documentRef.getElementById("dailySalaryResult")
    };

    let records = {};
    try {
      const stored = storage && storage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && parsed.version === 1 && parsed.months && typeof parsed.months === "object") {
        records = parsed.months;
      }
    } catch (error) {
      records = {};
    }

    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth() + 1;
    const initialPeriod = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const salarySettings = loadSalarySettings(storage, records, initialPeriod);
    let currentKey = "";
    let currentRecord = emptyRecord();
    let focusedDay = 1;

    function periodKey(year, month) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }

    function persist() {
      if (!storage) {
        status.textContent = "Local storage is unavailable; changes will not persist after closing this page.";
        return;
      }

      try {
        records[currentKey] = currentRecord;
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, months: records }));
        status.textContent = "Changes saved on this device.";
      } catch (error) {
        status.textContent = "Could not save changes in this browser.";
      }
    }

    function persistSalarySettings() {
      if (!storage) return;
      try {
        storage.setItem(SALARY_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, settings: salarySettings }));
      } catch (error) {
        status.textContent = "Could not save salary settings in this browser.";
      }
    }

    persistSalarySettings();

    function setControlsFromRecord() {
      monthSelect.value = String(currentMonth);
      yearInput.value = String(currentYear);
      salaryInput.value = salarySettings.salary;
      paidLeaveInput.value = String(salarySettings.paidLeave);
      const selectedWorkweek = documentRef.querySelector(`input[name="workweek"][value="${currentRecord.workweek}"]`);
      if (selectedWorkweek) selectedWorkweek.checked = true;
    }

    function loadPeriod(year, month, preferredDay) {
      const safeYear = Math.min(9999, Math.max(1900, Math.trunc(Number(year) || today.getFullYear())));
      const safeMonth = Math.min(12, Math.max(1, Math.trunc(Number(month) || 1)));
      currentYear = safeYear;
      currentMonth = safeMonth;
      currentKey = periodKey(currentYear, currentMonth);
      currentRecord = normalizeRecord(records[currentKey], currentYear, currentMonth);
      records[currentKey] = currentRecord;
      focusedDay = Math.min(Math.max(1, Number(preferredDay) || 1), daysInMonth(currentYear, currentMonth));
      setControlsFromRecord();
      renderAll();
      persist();
    }

    function monthCaption() {
      return `${monthNameFormatter.format(new Date(currentYear, currentMonth - 1, 1))} ${currentYear}`;
    }

    function currentCalculation() {
      return calculateMonth({
        year: currentYear,
        month: currentMonth,
        salary: salaryInput.value,
        paidLeave: paidLeaveInput.value,
        workweek: currentRecord.workweek,
        overrides: currentRecord.overrides,
        holidays
      });
    }

    function formatNumber(value) {
      return numberFormatter.format(value);
    }

    function formatCurrency(value) {
      return currencyFormatter.format(value);
    }

    function persistHolidayList() {
      if (!storage) {
        holidayListStatus.textContent = "The holiday list changed, but browser storage is unavailable.";
        return;
      }
      try {
        storage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify({ version: 1, holidays }));
        holidayListStatus.textContent = `Saved ${formatNumber(holidays.length)} paid holidays on this device.`;
      } catch (error) {
        holidayListStatus.textContent = "Could not save the holiday list in this browser.";
      }
    }

    function buildHolidayWorkbook() {
      const xlsx = documentRef.defaultView.XLSX;
      if (!xlsx) throw new Error("The local Excel workbook tool did not load.");
      const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const rows = [["Date", "Day", "Holiday"]];
      for (const holiday of normalizeHolidayList(holidays)) {
        const [year, month, day] = holiday.date.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        rows.push([date, weekdayNames[date.getUTCDay()], holiday.name]);
      }

      const workbook = xlsx.utils.book_new();
      const holidaySheet = xlsx.utils.aoa_to_sheet(rows);
      holidaySheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 32 }];
      holidaySheet["!autofilter"] = { ref: `A1:C${rows.length}` };
      for (let row = 2; row <= rows.length; row += 1) {
        const dateCell = holidaySheet[`A${row}`];
        if (dateCell) dateCell.z = "d mmm yyyy";
      }
      xlsx.utils.book_append_sheet(workbook, holidaySheet, "Holidays");

      const instructions = xlsx.utils.aoa_to_sheet([
        ["Monthline Holiday List"],
        ["Edit the Holidays sheet and save this workbook as .xlsx."],
        ["Keep the Date and Holiday columns filled for each paid holiday."],
        ["Dates may be Excel dates or YYYY-MM-DD values; Day is for reference."],
        ["Import the edited workbook in Monthline. Import replaces the saved list on this device."],
        ["The workbook and salary details are processed locally and are never uploaded."]
      ]);
      instructions["!cols"] = [{ wch: 96 }];
      xlsx.utils.book_append_sheet(workbook, instructions, "Instructions");
      workbook.Props = { Title: "Monthline Paid Holiday List", Subject: "Editable paid holiday dates" };
      return workbook;
    }

    function parseExcelDate(value, xlsx) {
      if (value instanceof Date && !Number.isNaN(value.valueOf())) {
        return value.toISOString().slice(0, 10);
      }
      if (typeof value === "number") {
        const parts = xlsx.SSF.parse_date_code(value);
        if (parts) return dateKey(parts.y, parts.m, parts.d);
        return "";
      }

      const text = String(value || "").trim();
      if (isValidDateKey(text)) return text;
      const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dayFirst) {
        const candidate = `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
        return isValidDateKey(candidate) ? candidate : "";
      }
      const parsed = new Date(text);
      return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
    }

    function parseHolidayWorkbook(workbook) {
      const xlsx = documentRef.defaultView.XLSX;
      const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "holidays") || workbook.SheetNames[0];
      if (!sheetName) throw new Error("No worksheet was found in this workbook.");
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true });
      if (rows.length === 0) throw new Error("The Holidays sheet has no holiday rows.");

      const headers = Object.keys(rows[0]);
      const normalizeHeader = (header) => header.trim().toLowerCase().replace(/\s+/g, " ");
      const dateHeader = headers.find((header) => normalizeHeader(header) === "date");
      const nameHeader = headers.find((header) => ["holiday", "holiday name", "name"].includes(normalizeHeader(header)));
      if (!dateHeader || !nameHeader) throw new Error("The sheet needs Date and Holiday columns in its first row.");

      const imported = [];
      const seenDates = new Set();
      rows.forEach((row, index) => {
        const dateValue = row[dateHeader];
        const name = String(row[nameHeader] || "").trim();
        if ((dateValue === "" || dateValue === null) && !name) return;
        const date = parseExcelDate(dateValue, xlsx);
        if (!date) throw new Error(`Row ${index + 2} has an invalid date.`);
        if (!name) throw new Error(`Row ${index + 2} is missing a holiday name.`);
        if (name.length > 100) throw new Error(`Row ${index + 2} has a name longer than 100 characters.`);
        if (seenDates.has(date)) throw new Error(`The date ${date} appears more than once.`);
        seenDates.add(date);
        imported.push({ date, name });
      });

      if (imported.length === 0) throw new Error("Add at least one paid holiday before importing.");
      return normalizeHolidayList(imported);
    }

    function renderCalendar(calculation) {
      const firstWeekday = new Date(currentYear, currentMonth - 1, 1).getDay();
      const cells = [];
      for (let blank = 0; blank < firstWeekday; blank += 1) {
        cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
      }

      for (const dayRecord of calculation.dayRecords) {
        const { day, category, holidayName } = dayRecord;
        let cssCategory = category;
        let label = "Working day";

        if (category === "holiday") {
          label = "Paid holiday";
        } else if (category === "leave") {
          const isPaid = calculation.paidDates.has(day);
          cssCategory = isPaid ? "paid" : "unpaid";
          label = isPaid ? "Paid leave" : "Unpaid leave";
        } else if (category === "off") {
          label = "Weekly off";
        } else {
          cssCategory = "work";
        }

        const compactLabel = {
          work: "Work",
          holiday: "Holiday",
          off: "Off",
          paid: "Paid",
          unpaid: "Unpaid"
        }[cssCategory];
        const date = new Date(currentYear, currentMonth - 1, day);
        const accessibleDate = longDateFormatter.format(date);
        const accessibleHolidayName = holidayName ? `${escapeHtml(holidayName)}, ` : "";
        const actionLabel = category === "leave"
          ? "Click to remove leave."
          : category === "holiday"
            ? "Paid holiday; clicking will not mark leave."
            : category === "off"
              ? "Weekly off; clicking will not mark leave."
              : "Click to mark leave.";
        const title = `${holidayName ? `${escapeHtml(holidayName)}: ` : ""}${label}. ${actionLabel}`;
        const accessibleAction = category === "leave"
          ? "Activate to remove leave."
          : category === "holiday"
            ? "Paid holiday. No leave is needed."
            : category === "off"
              ? "Weekly off. No leave is counted."
              : "Activate to mark as leave.";
        const isFocused = day === focusedDay;
        cells.push(
          `<button class="calendar-day" type="button" role="gridcell" data-day="${day}" data-category="${cssCategory}" tabindex="${isFocused ? "0" : "-1"}" aria-label="${accessibleDate}, ${accessibleHolidayName}${label}. ${accessibleAction}" title="${title}"><span class="day-number">${day}</span><span class="day-status" data-compact-label="${compactLabel}">${label}</span>${holidayName ? `<span class="day-event">${escapeHtml(holidayName)}</span>` : ""}</button>`
        );
      }

      calendarGrid.innerHTML = cells.join("");
      documentRef.getElementById("calendarMonthTitle").textContent = monthCaption();
      documentRef.getElementById("calendarDaysCount").textContent = formatNumber(calculation.totalDays);
      documentRef.getElementById("workingDaysCount").textContent = formatNumber(calculation.scheduledWorkingDays);
      documentRef.getElementById("weeklyOffsCount").textContent = formatNumber(calculation.weeklyOffs);
      resetButton.disabled = Object.keys(currentRecord.overrides).length === 0;
    }

    function renderSummary(calculation) {
      metricNodes.monthlySalary.textContent = calculation.salaryConfigured ? formatCurrency(calculation.salary) : "—";
      metricNodes.calendarDays.textContent = formatNumber(calculation.totalDays);
      metricNodes.workingDays.textContent = formatNumber(calculation.scheduledWorkingDays);
      metricNodes.holidays.textContent = formatNumber(calculation.governmentHolidays);
      metricNodes.weeklyOffs.textContent = formatNumber(calculation.weeklyOffs);
      metricNodes.leaveDays.textContent = formatNumber(calculation.leaveDays);
      metricNodes.paidUsed.textContent = formatNumber(calculation.paidLeaveUsed);
      metricNodes.paidRemaining.textContent = formatNumber(calculation.paidLeaveRemaining);
      metricNodes.unpaidLeave.textContent = formatNumber(calculation.unpaidLeaveDays);
      metricNodes.dailySalary.textContent = calculation.dailySalary === null || !calculation.salaryConfigured
        ? "—"
        : formatCurrency(calculation.dailySalary);

      documentRef.getElementById("finalSalary").textContent = calculation.salaryConfigured
        ? formatCurrency(calculation.estimatedSalary)
        : "Add salary";
      documentRef.getElementById("salaryDeduction").textContent = formatCurrency(calculation.deduction);
      documentRef.getElementById("resultPeriod").textContent = monthCaption();

      const note = documentRef.getElementById("calculationNote");
      if (!calculation.salaryConfigured) {
        note.textContent = "Enter your monthly salary to see the estimate and daily rate.";
      } else if (calculation.scheduledWorkingDays === 0) {
        note.textContent = "No scheduled working days remain. Daily rate is unavailable until a working day is set.";
      } else if (calculation.unpaidLeaveDays > 0) {
        note.textContent = `${formatNumber(calculation.unpaidLeaveDays)} unpaid leave ${calculation.unpaidLeaveDays === 1 ? "day" : "days"} × ${formatCurrency(calculation.dailySalary)} per scheduled working day.`;
      } else {
        note.textContent = "No unpaid-leave deduction for this month.";
      }
    }

    function renderAll() {
      const calculation = currentCalculation();
      renderCalendar(calculation);
      renderSummary(calculation);
    }

    function updateRecordFromControls() {
      salarySettings.salary = salaryInput.value;
      salarySettings.paidLeave = Math.max(0, Math.floor(Number(paidLeaveInput.value) || 0));
      paidLeaveInput.value = String(salarySettings.paidLeave);
      persistSalarySettings();
      persist();
      renderAll();
    }

    function toggleLeave(day) {
      const dayKey = String(day);
      const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
      const category = categoryForDay(currentYear, currentMonth, day, currentRecord.overrides, currentRecord.workweek, holidaysByDate);
      const holidayName = holidayNameForDate(currentYear, currentMonth, day, holidays);

      if (category === "holiday") {
        status.textContent = `${holidayName || "This date"} is already a paid holiday. It does not need a leave entry.`;
        return;
      }
      if (category === "off") {
        const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(new Date(currentYear, currentMonth - 1, day));
        status.textContent = `${weekday} is a weekly off. Leave can only be marked on a scheduled working day.`;
        return;
      }

      focusedDay = day;
      let actionMessage;
      if (category === "leave") {
        delete currentRecord.overrides[dayKey];
        if (currentRecord.leaveReturns[dayKey]) {
          currentRecord.overrides[dayKey] = currentRecord.leaveReturns[dayKey];
          delete currentRecord.leaveReturns[dayKey];
        }
        actionMessage = `${holidayNameForDate(currentYear, currentMonth, day, holidays) || `Day ${day}`} leave removed.`;
      } else {
        if (currentRecord.overrides[dayKey] === "work") {
          currentRecord.leaveReturns[dayKey] = "work";
        }
        currentRecord.overrides[dayKey] = "leave";
        const calculation = currentCalculation();
        actionMessage = calculation.paidDates.has(day)
          ? `Day ${day} marked as paid leave.`
          : `Day ${day} marked as unpaid leave.`;
      }

      records[currentKey] = currentRecord;
      persist();
      renderAll();
      status.textContent = actionMessage;
      requestAnimationFrame(() => focusCalendarDay(day));
    }

    documentRef.getElementById("downloadHolidayWorkbook").addEventListener("click", () => {
      try {
        const xlsx = documentRef.defaultView.XLSX;
        const data = xlsx.write(buildHolidayWorkbook(), { bookType: "xlsx", type: "array", compression: true });
        const blob = new documentRef.defaultView.Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = documentRef.defaultView.URL.createObjectURL(blob);
        const downloadLink = documentRef.createElement("a");
        downloadLink.href = url;
        downloadLink.download = "monthline-holidays.xlsx";
        documentRef.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        documentRef.defaultView.setTimeout(() => documentRef.defaultView.URL.revokeObjectURL(url), 1000);
        holidayListStatus.textContent = "Downloaded the current holiday list as an Excel workbook.";
      } catch (error) {
        holidayListStatus.textContent = `Could not create the Excel workbook. ${error.message}`;
      }
    });

    documentRef.getElementById("importHolidayWorkbook").addEventListener("click", () => holidayWorkbookFile.click());

    holidayWorkbookFile.addEventListener("change", async () => {
      const file = holidayWorkbookFile.files && holidayWorkbookFile.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        holidayListStatus.textContent = "This workbook is too large. Choose a file smaller than 10 MB.";
        holidayWorkbookFile.value = "";
        return;
      }

      try {
        const xlsx = documentRef.defaultView.XLSX;
        if (!xlsx) throw new Error("The local Excel workbook tool did not load.");
        const workbook = xlsx.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const importedHolidays = parseHolidayWorkbook(workbook);
        holidays = importedHolidays;
        const importedHolidayDates = new Set(holidays.map((holiday) => holiday.date));

        for (const [period, record] of Object.entries(records)) {
          if (!record || !record.overrides) continue;
          const periodParts = period.match(/^(\d{4})-(\d{2})$/);
          if (!periodParts) continue;
          const [, year, month] = periodParts;
          for (const [day, category] of Object.entries(record.overrides)) {
            const holidayDate = dateKey(year, month, Number(day));
            if (category === "holiday" || importedHolidayDates.has(holidayDate)) {
              delete record.overrides[day];
              if (record.leaveReturns) delete record.leaveReturns[day];
            }
          }
        }
        if (storage) {
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, months: records }));
          } catch (error) {
            holidayListStatus.textContent = "Imported, but could not update saved date overrides.";
          }
        }

        persistHolidayList();
        renderAll();
        holidayListStatus.textContent = `Imported ${formatNumber(holidays.length)} paid holidays. The updated list is saved on this device.`;
      } catch (error) {
        holidayListStatus.textContent = `Could not import this workbook. ${error.message}`;
      } finally {
        holidayWorkbookFile.value = "";
      }
    });

    function focusCalendarDay(day) {
      const button = calendarGrid.querySelector(`[data-day="${day}"]`);
      if (button) button.focus();
    }

    function changePeriod(year, month, preferredDay) {
      persist();
      loadPeriod(year, month, preferredDay);
      if (preferredDay !== undefined) {
        requestAnimationFrame(() => focusCalendarDay(focusedDay));
      }
    }

    monthSelect.addEventListener("change", () => {
      changePeriod(currentYear, Number(monthSelect.value));
    });

    yearInput.addEventListener("change", () => {
      const enteredYear = Number(yearInput.value);
      if (!Number.isInteger(enteredYear) || enteredYear < 1900 || enteredYear > 9999) {
        yearInput.value = String(currentYear);
        return;
      }
      changePeriod(enteredYear, currentMonth);
    });

    salaryInput.addEventListener("input", updateRecordFromControls);
    paidLeaveInput.addEventListener("input", updateRecordFromControls);

    for (const radio of documentRef.querySelectorAll('input[name="workweek"]')) {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        currentRecord.workweek = Number(radio.value) === 6 ? 6 : 5;
        const offScheduleLeaves = Object.keys(currentRecord.overrides).filter((day) =>
          currentRecord.overrides[day] === "leave" &&
          isScheduledOff(currentYear, currentMonth, Number(day), currentRecord.workweek)
        );
        for (const day of offScheduleLeaves) {
          delete currentRecord.overrides[day];
          delete currentRecord.leaveReturns[day];
        }
        records[currentKey] = currentRecord;
        persist();
        renderAll();
        if (offScheduleLeaves.length > 0) {
          status.textContent = `${formatNumber(offScheduleLeaves.length)} leave ${offScheduleLeaves.length === 1 ? "date was" : "dates were"} returned to the weekly-off schedule.`;
        }
      });
    }

    documentRef.getElementById("previousMonth").addEventListener("click", () => {
      const previous = new Date(currentYear, currentMonth - 2, 1);
      changePeriod(previous.getFullYear(), previous.getMonth() + 1);
    });

    documentRef.getElementById("nextMonth").addEventListener("click", () => {
      const next = new Date(currentYear, currentMonth, 1);
      changePeriod(next.getFullYear(), next.getMonth() + 1);
    });

    calendarGrid.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-day]");
      if (!button) return;
      toggleLeave(Number(button.dataset.day));
    });

    calendarGrid.addEventListener("keydown", (event) => {
      const button = event.target.closest("button[data-day]");
      const movement = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      if (!button || !movement) return;
      event.preventDefault();
      const targetDate = new Date(currentYear, currentMonth - 1, Number(button.dataset.day) + movement);
      if (targetDate.getMonth() + 1 !== currentMonth || targetDate.getFullYear() !== currentYear) {
        changePeriod(targetDate.getFullYear(), targetDate.getMonth() + 1, targetDate.getDate());
      } else {
        focusedDay = targetDate.getDate();
        for (const dayButton of calendarGrid.querySelectorAll("button[data-day]")) {
          dayButton.tabIndex = Number(dayButton.dataset.day) === focusedDay ? 0 : -1;
        }
        focusCalendarDay(focusedDay);
      }
    });

    resetButton.addEventListener("click", () => {
      if (Object.keys(currentRecord.overrides).length === 0) return;
      resetDialog.showModal();
    });

    documentRef.getElementById("cancelReset").addEventListener("click", () => resetDialog.close());

    documentRef.getElementById("confirmReset").addEventListener("click", () => {
      resetDialog.close();
      currentRecord.overrides = {};
      currentRecord.leaveReturns = {};
      persist();
      renderAll();
      status.textContent = `Date markings cleared for ${monthCaption()}.`;
    });

    loadPeriod(currentYear, currentMonth);

    return {
      changePeriod,
      calculate: currentCalculation
    };
  }

  return {
    calculateMonth,
    daysInMonth,
    initialize,
    normalizeHolidayList
  };
});