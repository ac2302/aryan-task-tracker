// Global state
const state = {
  tasks: {}, // Organized by date: { '2025-05-06': [task1, task2, ...] }
  currentDate: new Date(),
  displayDate: new Date(),
  selectedDate: new Date(),
  selectedTaskIndex: null,
  selectedHistoryEntry: null,
  trackingType: null,
};

// Format functions
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

function formatTimeForInput(date) {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "0:00";
  let seconds = Math.floor((ms / 1000) % 60);
  let minutes = Math.floor((ms / (1000 * 60)) % 60);
  let hours = Math.floor(ms / (1000 * 60 * 60));
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  } else {
    return `${minutes}:${paddedSeconds}`;
  }
}

function formatTimeHHMM(ms) {
  if (!ms) return "00:00";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

// Helper function for scrolling to elements
function scrollToElement(
  element,
  options = { behavior: "smooth", block: "start" }
) {
  if (element) {
    element.scrollIntoView(options);
  }
}

// Helper function to make textarea auto-expand
function autoExpandTextarea(textarea) {
  // Reset height to auto to ensure it shrinks when text is deleted
  textarea.style.height = "auto";
  // Set height to scrollHeight to fit content
  textarea.style.height = textarea.scrollHeight + "px";
}

// Storage functions
function saveState() {
  localStorage.setItem("taskTrackerData", JSON.stringify(state.tasks));
}

function loadState() {
  const savedData = localStorage.getItem("taskTrackerData");
  if (savedData) {
    try {
      state.tasks = JSON.parse(savedData);
      for (const dateKey in state.tasks) {
        state.tasks[dateKey].forEach((task) => {
          if (task.timeEntries) {
            task.timeEntries.forEach((entry) => {
              entry.time = new Date(entry.time);
            });
            task.timeEntries.sort((a, b) => a.time - b.time);
          }
          // Migrate old manualTime to manualTimeAdded if needed
          if (typeof task.manualTime === "number") {
            task.manualTimeAdded =
              (task.manualTimeAdded || 0) + task.manualTime;
            delete task.manualTime;
          }
          // Migrate title -> name
          if (!task.name && task.title) {
            task.name = task.title;
            delete task.title;
          }
          // Ensure notes field exists
          task.notes = task.notes || "";
        });
      }
    } catch (e) {
      console.error("Error loading state:", e);
      state.tasks = {};
    }
  }
}

// Calendar functions
function generateCalendar() {
  const calendarBody = document.getElementById("calendar-body");
  calendarBody.innerHTML = "";

  const year = state.displayDate.getFullYear();
  const month = state.displayDate.getMonth();

  document.getElementById("calendar-title").textContent = new Date(
    year,
    month,
    1
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const startingDay = firstDay.getDay();
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const cellsBefore = startingDay;
  const totalCells = cellsBefore + totalDays;
  const cellsAfter = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const grandTotal = totalCells + cellsAfter;

  let dayCount = 0;

  // Helper function to calculate total time for a day
  function calculateDayTotalTime(dateKey) {
    if (!state.tasks[dateKey] || !state.tasks[dateKey].length) return 0;

    let totalMs = 0;

    state.tasks[dateKey].forEach((task) => {
      // Calculate tracked time
      let tracked = 0;
      let lastStart = null;

      if (task.timeEntries?.length) {
        task.timeEntries.forEach((entry) => {
          if (entry.type === "start") {
            lastStart = entry.time;
          } else if (entry.type === "stop" && lastStart) {
            tracked += entry.time.getTime() - lastStart.getTime();
            lastStart = null;
          }
        });

        // If task is still running
        const last = task.timeEntries[task.timeEntries.length - 1];
        if (last && last.type === "start") {
          tracked += new Date().getTime() - lastStart.getTime();
        }
      }

      // Add manual time adjustments
      const manualAdded = task.manualTimeAdded || 0;
      const manualRemoved = task.manualTimeRemoved || 0;
      totalMs += Math.max(0, tracked + manualAdded - manualRemoved);
    });

    return totalMs;
  }

  for (let i = 0; i < grandTotal / 7; i++) {
    const row = document.createElement("tr");
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("td");
      let cellDate,
        cellDay,
        isOther = false;

      if (dayCount < cellsBefore) {
        cellDay = prevMonthLastDay - cellsBefore + dayCount + 1;
        cellDate = new Date(year, month - 1, cellDay);
        cell.classList.add("other-month");
        isOther = true;
      } else if (dayCount >= cellsBefore + totalDays) {
        cellDay = dayCount - cellsBefore - totalDays + 1;
        cellDate = new Date(year, month + 1, cellDay);
        cell.classList.add("other-month");
        isOther = true;
      } else {
        cellDay = dayCount - cellsBefore + 1;
        cellDate = new Date(year, month, cellDay);
      }

      // Create a structured cell content
      const cellContent = document.createElement("div");
      cellContent.className = "cell-content";

      // Add day number
      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = cellDay;
      cellContent.appendChild(dayNumber);

      cell.appendChild(cellContent);
      cell.dataset.date = formatDate(cellDate);

      if (
        cellDate.toDateString() === state.currentDate.toDateString() &&
        !isOther
      ) {
        cell.classList.add("today");
      }
      if (cellDate.toDateString() === state.selectedDate.toDateString()) {
        cell.classList.add("selected");
      }

      const dateKey = formatDate(cellDate);
      if (state.tasks[dateKey]?.length) {
        // Calculate and display total time
        const totalTime = calculateDayTotalTime(dateKey);
        const timeDisplay = document.createElement("div");
        timeDisplay.className = "time-display";
        timeDisplay.textContent = formatTimeHHMM(totalTime);
        cellContent.appendChild(timeDisplay);

        // Add task indicators
        const indicator = document.createElement("div");
        indicator.className = "task-indicator";
        const taskCount = state.tasks[dateKey].length;
        const count = Math.min(8, taskCount);
        const redCount = Math.max(0, Math.min(count, taskCount - 8));
        for (let k = 0; k < count; k++) {
          const dot = document.createElement("div");
          dot.className = k < redCount ? "task-dot-red" : "task-dot";
          indicator.appendChild(dot);
        }
        cellContent.appendChild(indicator);
      }

      cell.addEventListener("click", () => {
        const clicked = cell.dataset.date;
        const newDate = new Date(clicked);
        const prev = document.querySelector(".calendar td.selected");
        if (prev) prev.classList.remove("selected");
        cell.classList.add("selected");
        state.selectedDate = newDate;

        if (
          newDate.getMonth() !== state.displayDate.getMonth() ||
          newDate.getFullYear() !== state.displayDate.getFullYear()
        ) {
          state.displayDate = new Date(
            newDate.getFullYear(),
            newDate.getMonth(),
            1
          );
          generateCalendar();
          document
            .querySelector(`.calendar td[data-date="${clicked}"]`)
            ?.classList.add("selected");
        }
        updateTasksView();
      });

      row.appendChild(cell);
      dayCount++;
    }
    calendarBody.appendChild(row);
  }
}

function updateTasksView() {
  const dateKey = formatDate(state.selectedDate);
  const list = document.getElementById("task-list");
  const dateDisplay = document.getElementById("tasks-date");
  dateDisplay.textContent = formatDateDisplay(state.selectedDate);

  // Clear intervals
  list.querySelectorAll(".task-item").forEach((el) => {
    if (el.dataset.intervalId) {
      clearInterval(parseInt(el.dataset.intervalId));
    }
  });

  list.innerHTML = "";
  const tasks = state.tasks[dateKey] || [];
  if (!tasks.length) {
    const msg = document.createElement("div");
    msg.textContent = "No tasks for this day. Add a task to get started.";
    msg.style.textAlign = "center";
    msg.style.padding = "2rem";
    msg.style.color = "var(--text-muted)";
    list.appendChild(msg);
    return;
  }

  tasks.forEach((task, idx) => {
    list.appendChild(renderTask(task, idx));
  });
}

function renderTask(task, index) {
  const taskItem = document.createElement("div");
  taskItem.className = "task-item";
  taskItem.dataset.taskId = task.id; // Use the unique task ID

  // Calculate totalTime & running status
  let tracked = 0;
  let running = false,
    lastStart = null;
  if (task.timeEntries?.length) {
    task.timeEntries.sort((a, b) => a.time - b.time);
    task.timeEntries.forEach((entry) => {
      if (entry.type === "start") {
        lastStart = entry.time;
      } else if (entry.type === "stop" && lastStart) {
        tracked += entry.time.getTime() - lastStart.getTime();
        lastStart = null;
      }
    });
    const last = task.timeEntries[task.timeEntries.length - 1];
    if (last && last.type === "start") {
      running = true;
      lastStart = last.time;
      tracked += new Date().getTime() - lastStart.getTime();
    }
  }
  // Manual time
  const manualAdded = task.manualTimeAdded || 0;
  const manualRemoved = task.manualTimeRemoved || 0;
  let total = Math.max(0, tracked + manualAdded - manualRemoved);

  const header = document.createElement("div");
  header.className = "task-header";

  // Task title with edit icon
  const titleContainer = document.createElement("div");
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";
  titleContainer.style.gap = "8px";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.name;

  const editIcon = document.createElement("i");
  editIcon.className = "fas fa-edit";
  editIcon.style.cursor = "pointer";
  editIcon.style.fontSize = "0.8rem";
  editIcon.style.color = "var(--text-secondary)";
  editIcon.title = "Edit task name";
  editIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    editTaskName(index, task.name);
  });

  const copyIcon = document.createElement("i");
  copyIcon.className = "fas fa-copy";
  copyIcon.style.cursor = "pointer";
  copyIcon.style.fontSize = "0.8rem";
  copyIcon.style.color = "var(--text-secondary)";
  copyIcon.title = "Copy task details";
  copyIcon.addEventListener("click", (e) => {
    e.stopPropagation();

    // Format the time string
    const hours = Math.floor(total / 3600000);
    const minutes = Math.floor((total % 3600000) / 60000);

    const timeString =
      (hours ? `${hours} hour${hours > 1 ? "s" : ""}` : "") +
      (hours && minutes ? ", " : "") +
      (minutes ? `${minutes} minute${minutes > 1 ? "s" : ""}` : "0 minutes");

    const textToCopy = `${task.name}: ${timeString}\n${
      task.notes ? task.notes + "\n" : ""
    }`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      // Show a brief notification
      const notification = document.createElement("div");
      notification.textContent = "Copied to clipboard!";
      notification.style.position = "fixed";
      notification.style.bottom = "20px";
      notification.style.right = "20px";
      notification.style.backgroundColor = "var(--card-background)";
      notification.style.color = "var(--text-color)";
      notification.style.padding = "10px 20px";
      notification.style.borderRadius = "5px";
      notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
      notification.style.zIndex = "1000";
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 2000);
    });
  });

  titleContainer.appendChild(title);
  titleContainer.appendChild(editIcon);
  titleContainer.appendChild(copyIcon);

  const timeEl = document.createElement("div");
  timeEl.className = "task-time";
  timeEl.textContent = formatDuration(total);

  header.appendChild(titleContainer);
  header.appendChild(timeEl);

  // Set up live timer update if task is running
  if (running && lastStart) {
    const intervalId = setInterval(() => {
      const now = new Date().getTime();
      const updatedTracked = tracked + (now - lastStart.getTime());
      const updatedTotal = Math.max(
        0,
        updatedTracked + manualAdded - manualRemoved
      );

      // Get the timeEl reference again in case DOM has changed
      const timeElement = taskItem.querySelector(".task-time");
      if (timeElement) {
        timeElement.textContent = formatDuration(updatedTotal);
      } else {
        // If element doesn't exist anymore, clear the interval
        clearInterval(intervalId);
      }
    }, 1000); // Update every second

    // Store interval ID to clear it when view is updated
    taskItem.dataset.intervalId = intervalId;
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "task-actions";

  const startStopBtn = document.createElement("button");
  startStopBtn.classList.add(running ? "accent" : "success"); // Use success for start, accent for stop
  startStopBtn.title = running ? "Stop Tracking" : "Start Tracking";
  startStopBtn.innerHTML = running
    ? '<i class="fas fa-stop"></i>'
    : '<i class="fas fa-play"></i>';
  startStopBtn.addEventListener("click", () => {
    openTrackingModal(index, running ? "stop" : "start");
  });

  const addTimeBtn = document.createElement("button");
  addTimeBtn.classList.add("secondary");
  addTimeBtn.title = "Add Manual Time";
  addTimeBtn.innerHTML = '<i class="fas fa-plus-square"></i>';
  addTimeBtn.addEventListener("click", () => {
    state.selectedTaskIndex = index;
    openAddHoursModal();
  });

  // Create history button
  const historyBtn = document.createElement("button");
  historyBtn.classList.add("history-btn");
  historyBtn.title = "View Time History";
  historyBtn.innerHTML = '<i class="fas fa-history"></i>';

  // Create notes button
  const notesBtn = document.createElement("button");
  notesBtn.classList.add("notes-btn");
  notesBtn.title = "Toggle Notes";
  notesBtn.innerHTML = '<i class="fas fa-sticky-note"></i>';

  const removeTimeBtn = document.createElement("button");
  removeTimeBtn.classList.add("secondary"); // Changed to match add time button
  removeTimeBtn.title = "Remove Manual Time";
  removeTimeBtn.innerHTML = '<i class="fas fa-minus-square"></i>';
  removeTimeBtn.addEventListener("click", () => {
    state.selectedTaskIndex = index;
    openRemoveHoursModal();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("danger"); // Use danger for delete
  deleteBtn.title = "Delete Task";
  deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
  deleteBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const dateKey = formatDate(state.selectedDate);
    state.tasks[dateKey].splice(index, 1);
    if (!state.tasks[dateKey].length) delete state.tasks[dateKey];
    saveState();
    updateTasksView();
    generateCalendar(); // Regenerate calendar to update dot
  });

  // Configure toggle state for history button
  if (
    task.timeEntries?.length ||
    task.manualTimeAdded > 0 ||
    task.manualTimeRemoved > 0
  ) {
    historyBtn.addEventListener("click", () => {
      const existing = taskItem.querySelector(".task-history");
      if (existing) {
        existing.remove();
        historyBtn.classList.remove("active");
      } else {
        const historyElement = renderTimeHistory(task, index);
        taskItem.appendChild(historyElement);
        historyBtn.classList.add("active");
        // Scroll to the time history section
        setTimeout(() => scrollToElement(historyElement), 50);
      }
    });
  } else {
    historyBtn.disabled = true;
    historyBtn.style.opacity = "0.5";
    historyBtn.title = "No history available";
  }

  // Configure notes button with toggle state
  notesBtn.addEventListener("click", () => {
    const notesContainer = taskItem.querySelector(".task-notes-container");
    if (notesContainer) {
      notesContainer.classList.toggle("visible");

      if (notesContainer.classList.contains("visible")) {
        notesBtn.classList.add("active");
        // Scroll to notes section when it becomes visible
        setTimeout(() => scrollToElement(notesContainer), 50);
      } else {
        notesBtn.classList.remove("active");
      }
    }
  });

  // Add buttons in the requested order
  actions.appendChild(startStopBtn);
  actions.appendChild(addTimeBtn);
  actions.appendChild(removeTimeBtn);
  actions.appendChild(historyBtn);
  actions.appendChild(notesBtn);
  actions.appendChild(deleteBtn);

  taskItem.appendChild(header);
  taskItem.appendChild(actions);

  const notesContainer = document.createElement("div");
  notesContainer.className = "task-notes-container";
  if (task.notes && task.notes.trim() !== "") {
    notesContainer.classList.add("visible");
  }

  const notesTextarea = document.createElement("textarea");
  notesTextarea.placeholder = "Add notes...";
  notesTextarea.value = task.notes;
  notesTextarea.id = `notes-textarea-${task.id}`; // Assign a unique ID

  // Auto-expand functionality
  notesTextarea.addEventListener("input", function () {
    autoExpandTextarea(this);
  });

  // Debounced save for notes
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // Add autosave indicator element
  const saveIndicator = document.createElement("div");
  saveIndicator.className = "save-indicator";
  saveIndicator.textContent = "Auto-saved";
  saveIndicator.style.display = "none";

  notesTextarea.addEventListener(
    "input",
    debounce(() => {
      task.notes = notesTextarea.value;
      saveState();

      // Show save indicator
      saveIndicator.style.display = "block";
      saveIndicator.style.opacity = "1";
      setTimeout(() => {
        saveIndicator.style.opacity = "0";
        setTimeout(() => {
          saveIndicator.style.display = "none";
        }, 300);
      }, 1000);
    }, 500)
  );

  notesContainer.appendChild(notesTextarea);
  notesContainer.appendChild(saveIndicator);

  taskItem.appendChild(notesContainer);

  // Call autoExpandTextarea after notesTextarea is in the DOM and value is set
  // Needs a slight delay for the DOM to update if notesContainer was hidden
  if (notesContainer.classList.contains("visible")) {
    // If visible, can call directly, but might need a timeout if initial rendering is tricky
    setTimeout(() => autoExpandTextarea(notesTextarea), 0);
  } else {
    // If not visible, it will be called when it becomes visible via the toggle button
    // Or, we can call it here and trust the browser to calculate correctly even if not displayed.
    // Let's try calling it and see. If not, we'll adjust.
    setTimeout(() => autoExpandTextarea(notesTextarea), 0);
  }

  return taskItem;
}

function renderTimeHistory(task, taskIndex) {
  const section = document.createElement("div");
  section.className = "task-history";
  const manualAdded = task.manualTimeAdded || 0;
  const manualRemoved = task.manualTimeRemoved || 0;

  if (manualAdded > 0 || manualRemoved > 0) {
    // Render manual section if either is present
    const manualHeader = document.createElement("div");
    manualHeader.textContent = "Manual Adjustments:";
    manualHeader.style.fontWeight = "600";
    manualHeader.style.marginBottom = "0.5rem";
    section.appendChild(manualHeader);

    if (manualAdded > 0) {
      const manualEntry = document.createElement("div");
      manualEntry.className = "history-entry";
      const info = document.createElement("div");
      info.innerHTML = `➕ Added: ${formatDuration(
        manualAdded
      )} <span style="font-size:0.7em; color: var(--text-muted); margin-left: 0.5em;">(Resetting will clear this total)</span>`;
      const resetBtn = document.createElement("button");
      resetBtn.innerHTML = '<i class="fas fa-redo"></i>';
      resetBtn.classList.add("secondary", "icon-only"); // Use icon-only
      resetBtn.addEventListener("click", () => {
        const dateKey = formatDate(state.selectedDate);
        state.tasks[dateKey][taskIndex].manualTimeAdded = 0;
        saveState();
        updateTasksView();
      });
      manualEntry.appendChild(info);
      manualEntry.appendChild(resetBtn);
      section.appendChild(manualEntry);
    }
    if (manualRemoved > 0) {
      const manualEntry = document.createElement("div");
      manualEntry.className = "history-entry";
      const info = document.createElement("div");
      info.innerHTML = `➖ Removed: ${formatDuration(
        manualRemoved
      )} <span style="font-size:0.7em; color: var(--text-muted); margin-left: 0.5em;">(Resetting will clear this total)</span>`;

      const resetBtn = document.createElement("button");
      resetBtn.innerHTML = '<i class="fas fa-redo"></i> Reset';
      resetBtn.classList.add("secondary", "icon-only"); // Use icon-only
      resetBtn.addEventListener("click", () => {
        const dateKey = formatDate(state.selectedDate);
        state.tasks[dateKey][taskIndex].manualTimeRemoved = 0;
        saveState();
        updateTasksView();
      });
      manualEntry.appendChild(info);
      manualEntry.appendChild(resetBtn);
      section.appendChild(manualEntry);
    }

    const manualHr = document.createElement("hr");
    manualHr.style.margin = "1rem 0";
    manualHr.style.borderTop = "1px dashed var(--border-color)";
    section.appendChild(manualHr);
  }

  if (!task.timeEntries?.length) {
    if (manualAdded === 0 && manualRemoved === 0) {
      // Only show message if no entries at all
      const msg = document.createElement("div");
      msg.textContent = "No tracking entries yet.";
      section.appendChild(msg);
    }
    return section;
  }

  const trackingHeader = document.createElement("div");
  trackingHeader.textContent = "Tracking Entries:";
  trackingHeader.style.fontWeight = "600";
  trackingHeader.style.marginBottom = "0.5rem";
  section.appendChild(trackingHeader);

  task.timeEntries.forEach((entry, i) => {
    const entryDiv = document.createElement("div");
    entryDiv.className = "history-entry";
    const entryInfo = document.createElement("div");
    entryInfo.innerHTML = `${
      entry.type === "start"
        ? '<i class="fas fa-play" style="color: var(--success-color); margin-right: 0.5em;"></i> Started'
        : '<i class="fas fa-stop" style="color: var(--secondary-color); margin-right: 0.5em;"></i> Stopped'
    } at ${formatTime(entry.time)}`;
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";

    const editBtn = document.createElement("button");
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.classList.add("secondary", "icon-only");
    editBtn.addEventListener("click", () => {
      openEditModal(taskIndex, i);
    });

    const deleteEntryBtn = document.createElement("button");
    deleteEntryBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteEntryBtn.classList.add("danger", "icon-only");
    deleteEntryBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this time entry?")) {
        const dateKey = formatDate(state.selectedDate);
        state.tasks[dateKey][taskIndex].timeEntries.splice(i, 1);
        if (!state.tasks[dateKey][taskIndex].timeEntries.length) {
          delete state.tasks[dateKey][taskIndex].timeEntries;
        }
        saveState();
        updateTasksView();
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteEntryBtn);
    entryDiv.appendChild(entryInfo);
    entryDiv.appendChild(actions);
    section.appendChild(entryDiv);
  });

  return section;
}

function editTaskName(taskIndex, currentName) {
  const newName = prompt("Edit task name:", currentName);
  if (newName !== null && newName.trim() !== "" && newName !== currentName) {
    const dateKey = formatDate(state.selectedDate);
    state.tasks[dateKey][taskIndex].name = newName.trim();
    saveState();
    updateTasksView();
  }
}

function openEditModal(taskIndex, entryIndex) {
  state.selectedTaskIndex = taskIndex;
  state.selectedHistoryEntry = entryIndex;

  const dateKey = formatDate(state.selectedDate);
  const task = state.tasks[dateKey][taskIndex];
  const entry = task.timeEntries[entryIndex];

  const modal = document.getElementById("edit-modal");
  modal.style.display = "flex";
  document.getElementById("edit-time").value = formatTimeForInput(entry.time);
  document.getElementById("edit-type").value = entry.type;

  // Scroll to the edit modal
  setTimeout(
    () => scrollToElement(modal, { behavior: "smooth", block: "center" }),
    50
  );
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  state.selectedTaskIndex = null;
  state.selectedHistoryEntry = null;
}

function saveEdit() {
  const dateKey = formatDate(state.selectedDate);
  const timeInput = document.getElementById("edit-time");
  const typeSelect = document.getElementById("edit-type");
  const idx = state.selectedTaskIndex;
  const entryIdx = state.selectedHistoryEntry;
  if (idx === null || entryIdx === null || !timeInput.value) {
    alert("Please select a valid time.");
    return;
  }
  const parts = timeInput.value.split(":");
  const newDate = new Date(state.selectedDate);
  newDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
  if (isNaN(newDate.getTime())) {
    alert("Invalid time selected.");
    return;
  }
  const task = state.tasks[dateKey][idx];
  const entry = task.timeEntries[entryIdx];
  entry.type = typeSelect.value;
  entry.time = newDate;
  task.timeEntries.sort((a, b) => a.time - b.time);
  saveState();
  updateTasksView();
  closeEditModal();
}

function openAddHoursModal() {
  const modal = document.getElementById("add-hours-modal");
  modal.style.display = "flex";
  document.getElementById("add-hours-input").value = "";

  // Scroll to the add hours modal
  setTimeout(
    () => scrollToElement(modal, { behavior: "smooth", block: "center" }),
    50
  );
}

function closeAddHoursModal() {
  document.getElementById("add-hours-modal").style.display = "none";
  state.selectedTaskIndex = null;
}

function saveAddHours() {
  const dateKey = formatDate(state.selectedDate);
  const hours = parseInt(document.getElementById("add-hours-input").value) || 0;
  const minutes =
    parseInt(document.getElementById("add-minutes-input").value) || 0;
  const idx = state.selectedTaskIndex;
  if (idx !== null) {
    const task = state.tasks[dateKey][idx];
    const ms = hours * 3600000 + minutes * 60000;
    if (ms > 0) {
      task.manualTimeAdded = (task.manualTimeAdded || 0) + ms;
      saveState();
      updateTasksView();
    }
  }
  closeAddHoursModal();
}

function openRemoveHoursModal() {
  const modal = document.getElementById("remove-hours-modal");
  modal.style.display = "flex";
  document.getElementById("remove-hours-input").value = "";

  // Scroll to the remove hours modal
  setTimeout(
    () => scrollToElement(modal, { behavior: "smooth", block: "center" }),
    50
  );
}

function closeRemoveHoursModal() {
  document.getElementById("remove-hours-modal").style.display = "none";
  state.selectedTaskIndex = null;
}

function saveRemoveHours() {
  const dateKey = formatDate(state.selectedDate);
  const hours =
    parseInt(document.getElementById("remove-hours-input").value) || 0;
  const minutes =
    parseInt(document.getElementById("remove-minutes-input").value) || 0;
  const idx = state.selectedTaskIndex;
  if (idx !== null) {
    const task = state.tasks[dateKey][idx];
    const ms = hours * 3600000 + minutes * 60000;
    if (ms > 0) {
      task.manualTimeRemoved = (task.manualTimeRemoved || 0) + ms;
      saveState();
      updateTasksView();
    }
  }
  closeRemoveHoursModal();
}

function openTrackingModal(taskIndex, type) {
  state.selectedTaskIndex = taskIndex;
  state.trackingType = type;

  const modal = document.getElementById("tracking-modal");
  modal.style.display = "flex";
  document.getElementById("tracking-time").value = formatTimeForInput(
    new Date()
  );

  document.getElementById("tracking-title").textContent =
    type === "start" ? "Start Tracking" : "Stop Tracking";

  // Scroll to the tracking modal
  setTimeout(
    () => scrollToElement(modal, { behavior: "smooth", block: "center" }),
    50
  );
}

function closeTrackingModal() {
  document.getElementById("tracking-modal").style.display = "none";
  state.selectedTaskIndex = null;
  state.trackingType = null;
}

function confirmTrackingTime() {
  const dateKey = formatDate(state.selectedDate);
  const idx = state.selectedTaskIndex; // Index of the task we are trying to start/stop
  const type = state.trackingType; // "start" or "stop"
  const timeVal = document.getElementById("tracking-time").value;

  if (idx === null || !type || !timeVal) {
    alert("Something went wrong. Please try again.");
    closeTrackingModal();
    return;
  }

  const parts = timeVal.split(":");
  const dt = new Date(state.selectedDate); // Date from calendar, time from modal
  dt.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);

  if (isNaN(dt.getTime())) {
    alert("Invalid time entered.");
    return;
  }

  const taskToModify = state.tasks[dateKey]?.[idx];

  if (!taskToModify) {
    alert("Task not found.");
    closeTrackingModal();
    return;
  }

  taskToModify.timeEntries = taskToModify.timeEntries || [];

  if (type === "start") {
    // Prevent adding 'start' if THIS specific task is already running
    if (taskToModify.timeEntries.length > 0) {
      const lastEntryThisTask =
        taskToModify.timeEntries[taskToModify.timeEntries.length - 1];
      if (lastEntryThisTask.type === "start") {
        alert("This task is already running.");
        closeTrackingModal();
        return;
      }
    }

    // Check for OTHER running tasks
    const allCurrentlyRunning = getCurrentlyRunningTasks();
    const otherRunningTasks = allCurrentlyRunning.filter(
      (runningInfo) =>
        !(runningInfo.dateKey === dateKey && runningInfo.taskIndex === idx)
    );

    if (otherRunningTasks.length > 0) {
      const stopPrevious = window.confirm(
        "Another task is currently being tracked. Do you want to stop the previous task(s) and start tracking this new task?"
      );

      if (stopPrevious) {
        const stopTimeForOthers = new Date(); // Stop previous tasks NOW
        otherRunningTasks.forEach((runningInfo) => {
          const taskToStop = runningInfo.taskRef; // Direct reference to the task object
          // Double-check it's indeed running before adding a stop entry
          if (taskToStop.timeEntries && taskToStop.timeEntries.length > 0) {
            const lastEntryOther =
              taskToStop.timeEntries[taskToStop.timeEntries.length - 1];
            if (lastEntryOther.type === "start") {
              taskToStop.timeEntries.push({
                type: "stop",
                time: new Date(stopTimeForOthers.getTime()),
              }); // Use a copy of stopTimeForOthers
              taskToStop.timeEntries.sort(
                (a, b) => new Date(a.time) - new Date(b.time)
              );
            }
          }
        });
      }
      // If !stopPrevious (user clicks Cancel), the new task will start, and others continue tracking.
    }
    // Now, add the 'start' entry for the taskToModify
    taskToModify.timeEntries.push({
      type: "start",
      time: new Date(dt.getTime()),
    });
  } else if (type === "stop") {
    // Prevent adding 'stop' if THIS task is not running or already stopped
    if (taskToModify.timeEntries.length > 0) {
      const lastEntry =
        taskToModify.timeEntries[taskToModify.timeEntries.length - 1];
      if (lastEntry.type === "stop") {
        // Already stopped
        alert("Task is not currently running (already stopped).");
        closeTrackingModal();
        return;
      }
      // Check if there's a corresponding start for this stop action
      const startCount = taskToModify.timeEntries.filter(
        (e) => e.type === "start"
      ).length;
      const stopCount = taskToModify.timeEntries.filter(
        (e) => e.type === "stop"
      ).length;
      if (startCount <= stopCount) {
        // No pending start to stop, or more stops than starts
        alert("Task is not currently running (no active start entry).");
        closeTrackingModal();
        return;
      }
    } else {
      // No entries at all, so definitely not running
      alert("Task is not currently running (no entries).");
      closeTrackingModal();
      return;
    }
    // Add the 'stop' entry for the taskToModify
    taskToModify.timeEntries.push({
      type: "stop",
      time: new Date(dt.getTime()),
    });
  }

  taskToModify.timeEntries.sort((a, b) => new Date(a.time) - new Date(b.time));
  saveState();
  updateTasksView();
  generateCalendar(); // Update calendar for any changes in daily totals from stopping other tasks
  closeTrackingModal();
}

// Helper function to find currently running tasks
function getCurrentlyRunningTasks() {
  const running = [];
  for (const dateKey in state.tasks) {
    if (state.tasks.hasOwnProperty(dateKey)) {
      state.tasks[dateKey].forEach((task, index) => {
        // Ensure timeEntries exist and are sorted (though they should be by other functions)
        if (task.timeEntries && task.timeEntries.length > 0) {
          const lastEntry = task.timeEntries[task.timeEntries.length - 1];
          if (lastEntry.type === "start") {
            // Store a reference to the task object and its identifiers
            running.push({ taskRef: task, dateKey, taskIndex: index });
          }
        }
      });
    }
  }
  return running;
}

// Function to calculate total duration for a single task
function calculateTaskDuration(task) {
  let trackedMs = 0;
  let lastStart = null;

  if (task.timeEntries?.length) {
    task.timeEntries.forEach((entry) => {
      if (entry.type === "start") {
        lastStart = entry.time;
      } else if (entry.type === "stop" && lastStart) {
        trackedMs += entry.time.getTime() - lastStart.getTime();
        lastStart = null;
      }
    });

    // If task is still running (though for a daily report, this might imply it ran all day or was forgotten)
    // For simplicity, we'll assume tasks are stopped for a daily report, or we only count completed intervals.
    // If the last entry is a start and it's the selected day, it might be considered running until midnight or current time if it's today.
    // For this implementation, we will only count completed start-stop pairs.
  }

  const manualAdded = task.manualTimeAdded || 0;
  const manualRemoved = task.manualTimeRemoved || 0;
  return Math.max(0, trackedMs + manualAdded - manualRemoved);
}

// Function to copy task durations for the selected day
async function copyTaskDurations() {
  const dateKey = formatDate(state.selectedDate);
  const tasksForDay = state.tasks[dateKey] || [];

  if (tasksForDay.length === 0) {
    // Keep alert for empty days since it's more noticeable
    alert("No tasks to copy for the selected day.");
    return;
  }

  const dayOfWeek = state.selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
  });
  const day = state.selectedDate.getDate();
  const month = state.selectedDate.toLocaleDateString("en-US", {
    month: "long",
  });
  const year = state.selectedDate.getFullYear();

  let report = `${dayOfWeek} ${String(day).padStart(
    2,
    "0"
  )} ${month} ${year}:\n`;

  tasksForDay.forEach((task) => {
    const durationMs = calculateTaskDuration(task);
    const durationFormatted = formatTimeHHMM(durationMs);
    report += `- ${task.name} (${durationFormatted})\n`;
  });

  try {
    await navigator.clipboard.writeText(report);

    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById(
      "notification-container"
    );
    if (!notificationContainer) {
      notificationContainer = document.createElement("div");
      notificationContainer.id = "notification-container";
      notificationContainer.style.position = "fixed";
      notificationContainer.style.bottom = "20px";
      notificationContainer.style.left = "0";
      notificationContainer.style.width = "100%";
      notificationContainer.style.display = "flex";
      notificationContainer.style.justifyContent = "center";
      notificationContainer.style.zIndex = "1000";
      notificationContainer.style.pointerEvents = "none";
      document.body.appendChild(notificationContainer);
    }

    // Create and show toast notification
    const notification = document.createElement("div");
    notification.className = "copy-notification";
    notification.textContent = "Task durations copied to clipboard!";
    notificationContainer.appendChild(notification);

    // Remove notification after animation completes (3s)
    setTimeout(() => {
      notification.remove();
      // Remove container if empty
      if (notificationContainer.children.length === 0) {
        notificationContainer.remove();
      }
    }, 3000);
  } catch (err) {
    console.error("Failed to copy task durations: ", err);

    // Show error notification
    const notification = document.createElement("div");
    notification.className = "copy-notification";
    notification.textContent = "Failed to copy durations";
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Event listeners
function addEventListeners() {
  document.getElementById("prev-month").addEventListener("click", () => {
    state.displayDate = new Date(
      state.displayDate.getFullYear(),
      state.displayDate.getMonth() - 1,
      1
    );
    generateCalendar();
  });
  document.getElementById("next-month").addEventListener("click", () => {
    state.displayDate = new Date(
      state.displayDate.getFullYear(),
      state.displayDate.getMonth() + 1,
      1
    );
    generateCalendar();
  });
  document.getElementById("current-month").addEventListener("click", () => {
    state.displayDate = new Date();
    state.selectedDate = new Date();
    generateCalendar();
    updateTasksView();
  });

  document.getElementById("add-task-btn").addEventListener("click", addTask);
  document
    .getElementById("new-task-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTask();
      }
    });

  document
    .getElementById("close-edit-modal")
    .addEventListener("click", closeEditModal);
  document
    .getElementById("cancel-edit")
    .addEventListener("click", closeEditModal);
  document.getElementById("save-edit").addEventListener("click", saveEdit);

  document
    .getElementById("close-add-hours-modal")
    .addEventListener("click", closeAddHoursModal);
  document
    .getElementById("cancel-add-hours")
    .addEventListener("click", closeAddHoursModal);
  document
    .getElementById("save-add-hours")
    .addEventListener("click", saveAddHours);

  document
    .getElementById("close-remove-hours-modal")
    .addEventListener("click", closeRemoveHoursModal);
  document
    .getElementById("cancel-remove-hours")
    .addEventListener("click", closeRemoveHoursModal);
  document
    .getElementById("save-remove-hours")
    ?.addEventListener("click", saveRemoveHours);

  document
    .getElementById("close-tracking-modal")
    .addEventListener("click", closeTrackingModal);
  document
    .getElementById("cancel-tracking")
    .addEventListener("click", closeTrackingModal);
  document
    .getElementById("confirm-tracking")
    .addEventListener("click", confirmTrackingTime);

  window.addEventListener("click", (e) => {
    const edit = document.getElementById("edit-modal");
    const addH = document.getElementById("add-hours-modal");
    const removeH = document.getElementById("remove-hours-modal");
    const track = document.getElementById("tracking-modal");
    if (e.target === edit) closeEditModal();
    if (e.target === addH) closeAddHoursModal();
    if (e.target === removeH) closeRemoveHoursModal();
    if (e.target === track) closeTrackingModal();
  });

  // Add event listener for the new copy button
  const copyBtn = document.getElementById("copy-task-durations-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyTaskDurations);
  } else {
    console.error("Copy Task Durations button not found in the DOM.");
  }
}

function addTask() {
  const newTaskInput = document.getElementById("new-task-input");

  // Add null check for newTaskInput
  if (!newTaskInput) {
    console.error("Error: Could not find element with ID 'new-task-input'.");
    return;
  }

  const taskName = newTaskInput.value.trim();
  if (!taskName) {
    alert("Please enter a task name.");
    return;
  }

  const dateKey = formatDate(state.selectedDate);
  if (!state.tasks[dateKey]) {
    state.tasks[dateKey] = [];
  }

  // Check for duplicate task names on the same day
  if (
    state.tasks[dateKey].some(
      (task) => task.name.toLowerCase() === taskName.toLowerCase()
    )
  ) {
    alert(
      "A task with this name already exists for the selected day. Please use a different name."
    );
    return;
  }

  state.tasks[dateKey].push({
    name: taskName,
    timeEntries: [],
    manualTimeAdded: 0,
    manualTimeRemoved: 0,
    notes: "", // Initialize notes field
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
  });

  newTaskInput.value = "";
  saveState();
  updateTasksView();
  generateCalendar(); // Re-generate calendar to update daily totals if shown

  // Scroll to the newly added task
  setTimeout(() => {
    const taskItems = document.querySelectorAll(".task-item");
    if (taskItems.length > 0) {
      // Last task item is the one we just added
      const newTaskItem = taskItems[taskItems.length - 1];
      scrollToElement(newTaskItem);
    }
  }, 100); // Small delay to ensure DOM is updated
}

function initApp() {
  loadState();
  generateCalendar();
  updateTasksView();
  addEventListeners();
}

document.addEventListener("DOMContentLoaded", initApp);

// Update date handling to combine calendar date with selected time
const startDateInput = document.getElementById("start-date");
const startTimeInput = document.getElementById("start-time");

let startDate = new Date(startDateInput?.value);
let endDate = new Date(document.getElementById("end-date")?.value);

startDateInput?.addEventListener("change", () => {
  const date = new Date(startDateInput.value);
  // Preserve existing time while updating date
  startDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
});

startTimeInput?.addEventListener("change", () => {
  const [hours, minutes] = startTimeInput.value.split(":").map(Number);
  startDate.setHours(hours);
  startDate.setMinutes(minutes);
});

// Repeat similar logic for endDate and its inputs
