// State
let currentBookingId = null;
const API_BASE = `${window.location.origin}/api`;
let selectedCheckInDate = null;
let selectedCheckOutDate = null;
let currentCalendarMonth = new Date();
let allBookings = [];
let isOnline = navigator.onLine;

// Local Storage Keys
const STORAGE_BOOKINGS = 'sauna_bookings';
const STORAGE_EXPENSES = 'sauna_expenses';
const STORAGE_SHARES = 'sauna_shares';

// Online/Offline detection
window.addEventListener('online', () => {
  isOnline = true;
  showOnlineStatus(true);
  syncDataWithServer();
});

window.addEventListener('offline', () => {
  isOnline = false;
  showOnlineStatus(false);
});

function showOnlineStatus(online) {
  if (online) {
    console.log('🟢 Приложение онлайн');
  } else {
    console.log('🔴 Приложение офлайн - работа с локальными данными');
  }
}

// Local Storage Functions
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage full:', e);
  }
}

function getFromLocalStorage(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('LocalStorage read error:', e);
    return null;
  }
}

function syncDataWithServer() {
  console.log('🔄 Синхронизация данных с сервером...');
  loadBookings();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateCurrentDate();
  loadBookings();
  setUpEventListeners();
  setInterval(updateCurrentDate, 60000);
  showOnlineStatus(isOnline);

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.log('Service Worker registration failed:', err);
    });
  }
});

function setUpEventListeners() {
  document.getElementById('bookingForm').addEventListener('submit', handleAddBooking);
  document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);
  document.getElementById('addBookingBtn').addEventListener('click', () => showScreen('bookingScreen'));
  document.getElementById('addExpenseBtn').addEventListener('click', () => showScreen('expenseScreen'));
  document.getElementById('deleteBookingBtn').addEventListener('click', handleDeleteBooking);

  // Preview shares when price changes
  document.getElementById('totalPrice').addEventListener('input', updateSharesPreview);

  // Auto-set checkout date when checkin date is selected
  document.getElementById('checkIn').addEventListener('change', function() {
    if (this.value) {
      const [datePart, timePart] = this.value.split('T');
      const [year, month, day] = datePart.split('-');
      const nextDay = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) + 1);
      const checkOutYear = nextDay.getFullYear();
      const checkOutMonth = String(nextDay.getMonth() + 1).padStart(2, '0');
      const checkOutDay = String(nextDay.getDate()).padStart(2, '0');
      const checkOutDatetime = `${checkOutYear}-${checkOutMonth}-${checkOutDay}T${timePart}`;
      document.getElementById('checkOut').value = checkOutDatetime;
      document.getElementById('checkOut').min = checkOutDatetime;
    }
  });

  // Set min date/time to current
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('checkIn').min = now.toISOString().slice(0, 16);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (screenId === 'detailsScreen' && currentBookingId) {
    loadBookingDetails();
  }

  if (screenId === 'bookingScreen') {
    selectedCheckInDate = null;
    selectedCheckOutDate = null;
    currentCalendarMonth = new Date();
    document.getElementById('selectedDatesInfo').style.display = 'none';
    renderCalendar();
  }
}

function updateCurrentDate() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formatted = now.toLocaleDateString('ru-RU', options);
  document.getElementById('currentDate').textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function renderCalendar() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(firstDay);

  let html = `
    <div class="calendar-header">
      <button onclick="previousMonth()">← Пред</button>
      <span>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
      <button onclick="nextMonth()">След →</button>
    </div>
  `;

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  weekdays.forEach(day => {
    html += `<div class="calendar-weekday">${day}</div>`;
  });

  for (let i = 0; i < startingDayOfWeek; i++) {
    html += `<div class="calendar-date empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isInPast = dateStr < todayStr;
    const isBooked = isDateBooked(dateStr);
    const isSelected = (selectedCheckInDate && dateStr === selectedCheckInDate) || (selectedCheckOutDate && dateStr === selectedCheckOutDate);
    const isInRange = selectedCheckInDate && selectedCheckOutDate && dateStr > selectedCheckInDate && dateStr < selectedCheckOutDate;

    let className = 'calendar-date';
    if (isInPast) className += ' other-month';
    if (isBooked) className += ' booked';
    if (isSelected) className += ' selected';
    if (isInRange) className += ' in-range';

    html += `<div class="${className}" onclick="selectDate('${dateStr}')">${day}</div>`;
  }

  document.getElementById('calendarPicker').innerHTML = html;
}

function previousMonth() {
  currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
  renderCalendar();
}

function isDateBooked(dateStr) {
  return allBookings.some(booking => {
    const checkIn = booking.checkIn.split('T')[0];
    const checkOut = booking.checkOut.split('T')[0];
    return dateStr >= checkIn && dateStr < checkOut;
  });
}

function selectDate(dateStr) {
  if (isDateBooked(dateStr)) {
    alert('Эта дата уже забронирована');
    return;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (dateStr < todayStr) {
    alert('Выберите сегодня или позже');
    return;
  }

  if (!selectedCheckInDate) {
    selectedCheckInDate = dateStr;
  } else if (!selectedCheckOutDate) {
    if (dateStr <= selectedCheckInDate) {
      alert('Дата выезда должна быть позже даты заезда');
      return;
    }
    selectedCheckOutDate = dateStr;
  } else {
    selectedCheckInDate = dateStr;
    selectedCheckOutDate = null;
  }

  updateSelectedDatesInfo();
  renderCalendar();
}

function updateSelectedDatesInfo() {
  if (selectedCheckInDate && selectedCheckOutDate) {
    const checkInDate = new Date(selectedCheckInDate + 'T00:00:00');
    const checkOutDate = new Date(selectedCheckOutDate + 'T00:00:00');
    const days = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    document.getElementById('selectedCheckIn').textContent = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(checkInDate);
    document.getElementById('selectedCheckOut').textContent = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(checkOutDate);
    document.getElementById('selectedDays').textContent = days;
    document.getElementById('selectedDatesInfo').style.display = 'block';
  } else if (selectedCheckInDate) {
    const checkInDate = new Date(selectedCheckInDate + 'T00:00:00');
    document.getElementById('selectedCheckIn').textContent = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(checkInDate);
    document.getElementById('selectedCheckOut').textContent = '(выберите дату выезда)';
    document.getElementById('selectedDays').textContent = '-';
    document.getElementById('selectedDatesInfo').style.display = 'block';
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('ru-RU', options);
}

function updateSharesPreview() {
  const price = parseFloat(document.getElementById('totalPrice').value) || 0;
  const shareAmount = (price / 5).toFixed(0);
  const people = ['Алина', 'Папа', 'Серега', 'Артем', 'Дом'];

  let html = '';
  people.forEach(person => {
    html += `
      <div class="shares-preview-item">
        <span class="shares-preview-label">1/5 ${person}</span>
        <span class="shares-preview-value">${shareAmount} ₽</span>
      </div>
    `;
  });

  document.getElementById('sharesPreview').innerHTML = html;
}

async function handleAddBooking(e) {
  e.preventDefault();

  if (!selectedCheckInDate || !selectedCheckOutDate) {
    alert('Выберите даты заезда и выезда в календаре');
    return;
  }

  const guestName = document.getElementById('guestName').value;
  const checkInTime = document.getElementById('checkInTime').value;
  const checkOutTime = document.getElementById('checkOutTime').value;
  const checkIn = `${selectedCheckInDate}T${checkInTime}`;
  const checkOut = `${selectedCheckOutDate}T${checkOutTime}`;
  const totalPrice = parseFloat(document.getElementById('totalPrice').value);

  try {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName, checkIn, checkOut, totalPrice })
    });

    if (response.ok) {
      document.getElementById('bookingForm').reset();
      document.getElementById('sharesPreview').innerHTML = '';
      selectedCheckInDate = null;
      selectedCheckOutDate = null;
      loadBookings();
      showScreen('mainScreen');
    }
  } catch (error) {
    console.error('Error adding booking:', error);
    alert('Ошибка при добавлении брони');
  }
}

async function handleAddExpense(e) {
  e.preventDefault();

  const person = document.getElementById('expensePerson').value;
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const comment = document.getElementById('expenseComment').value;

  if (!person) {
    alert('Выберите человека');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: currentBookingId,
        person,
        amount,
        comment
      })
    });

    if (response.ok) {
      document.getElementById('expenseForm').reset();
      loadBookingDetails();
      showScreen('detailsScreen');
    }
  } catch (error) {
    console.error('Error adding expense:', error);
    alert('Ошибка при добавлении расхода');
  }
}

async function handleDeleteBooking() {
  if (!confirm('Вы уверены? Это действие удалит всю информацию о этой брони.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/bookings/${currentBookingId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadBookings();
      showScreen('mainScreen');
    }
  } catch (error) {
    console.error('Error deleting booking:', error);
    alert('Ошибка при удалении брони');
  }
}

async function handleDeleteExpense(expenseId) {
  if (!confirm('Удалить этот расход?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/expenses/${expenseId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadBookingDetails();
    }
  } catch (error) {
    console.error('Error deleting expense:', error);
    alert('Ошибка при удалении расхода');
  }
}

async function loadBookings() {
  try {
    const response = await fetch(`${API_BASE}/bookings`);
    const bookings = await response.json();
    allBookings = bookings;
    saveToLocalStorage(STORAGE_BOOKINGS, bookings);
    processAndRenderBookings(bookings);
  } catch (error) {
    console.warn('Failed to load bookings from server, using local data:', error);
    const localBookings = getFromLocalStorage(STORAGE_BOOKINGS);
    allBookings = localBookings || [];
    processAndRenderBookings(allBookings);
  }
}

function processAndRenderBookings(bookings) {
  const now = new Date();
  const booked = [];
  const free = [];

  bookings.forEach(booking => {
    const checkOut = new Date(booking.checkOut);
    if (checkOut > now) {
      booked.push(booking);
    }
  });

  if (booked.length === 0) {
    free.push({
      checkIn: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      checkOut: null,
      isFuture: true
    });
  } else {
    booked.sort((a, b) => new Date(a.checkOut) - new Date(b.checkOut));

    let lastCheckOut = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    for (let i = 0; i < booked.length; i++) {
      const nextCheckIn = new Date(booked[i].checkIn);
      if (nextCheckIn > lastCheckOut) {
        free.push({
          checkIn: lastCheckOut.toISOString(),
          checkOut: booked[i].checkIn,
          isFree: true
        });
      }
      lastCheckOut = new Date(booked[i].checkOut);
    }

    free.push({
      checkIn: lastCheckOut.toISOString(),
      checkOut: null,
      isFuture: true
    });
  }

  renderDatesList('bookedDates', booked, true);
  renderDatesList('freeDates', free, false);
}

function renderDatesList(elementId, items, isBooked) {
  const container = document.getElementById(elementId);

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>Нет данных</div>';
    return;
  }

  let html = '';
  items.forEach(item => {
    const checkInDate = formatDate(item.checkIn);
    const checkOutDate = item.checkOut ? formatDate(item.checkOut) : 'открыто';

    if (isBooked && item.id) {
      const days = Math.ceil((new Date(item.checkOut) - new Date(item.checkIn)) / (1000 * 60 * 60 * 24));
      html += `
        <div class="date-item booked" onclick="openBookingDetails(${item.id})">
          <div class="date-item-title">👤 ${item.guestName}</div>
          <div class="date-item-info">
            📍 ${checkInDate} - ${checkOutDate}<br>
            📅 ${days} дней
          </div>
          <div class="date-item-price">💰 ${item.totalPrice} ₽</div>
        </div>
      `;
    } else {
      html += `
        <div class="date-item free">
          <div class="date-item-title">✅ Свободно</div>
          <div class="date-item-info">
            📍 С ${checkInDate}<br>
            До ${checkOutDate}
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

async function openBookingDetails(bookingId) {
  currentBookingId = bookingId;
  showScreen('detailsScreen');
}

async function loadBookingDetails() {
  if (!currentBookingId) return;

  try {
    const response = await fetch(`${API_BASE}/bookings/${currentBookingId}/details`);
    const data = await response.json();
    const { booking, shares, expenses } = data;

    document.getElementById('detailsTitle').textContent = booking.guestName;

    // Booking info
    const days = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
    let infoHtml = `
      <div class="info-item">
        <span class="info-label">Гость</span>
        <span class="info-value">${booking.guestName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Въезд</span>
        <span class="info-value">${formatDate(booking.checkIn)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Выезд</span>
        <span class="info-value">${formatDate(booking.checkOut)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Дней</span>
        <span class="info-value">${days}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Сумма</span>
        <span class="info-value" style="color: #667eea; font-weight: 700;">${booking.totalPrice} ₽</span>
      </div>
    `;
    document.getElementById('bookingInfo').innerHTML = infoHtml;

    // Shares
    let sharesHtml = '';
    shares.forEach(share => {
      const remaining = (share.totalShare - share.spent).toFixed(0);
      sharesHtml += `
        <div class="share-row">
          <span class="share-name">${share.person}</span>
          <div class="share-values">
            <div class="share-value"><span style="color: #999; font-size: 12px;">Начисл:</span><br>${share.totalShare.toFixed(0)} ₽</div>
            <div class="share-value share-spent"><span style="color: #999; font-size: 12px;">Расход:</span><br>${share.spent.toFixed(0)} ₽</div>
            <div class="share-value share-remaining"><span style="color: #999; font-size: 12px;">Осталось:</span><br>${remaining} ₽</div>
          </div>
        </div>
      `;
    });
    document.getElementById('sharesTable').innerHTML = sharesHtml;

    // Expenses
    let expensesHtml = '';
    if (expenses.length === 0) {
      expensesHtml = '<div class="empty-state" style="padding: 20px;"><div class="empty-state-icon">📋</div>Нет расходов</div>';
    } else {
      expenses.forEach(expense => {
        const date = new Date(expense.createdAt);
        const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        expensesHtml += `
          <div class="expense-item">
            <div class="expense-info">
              <div class="expense-person">${expense.person}</div>
              ${expense.comment ? `<div class="expense-comment">${expense.comment}</div>` : ''}
              <div class="expense-date">${dateStr}</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <div class="expense-amount">-${expense.amount} ₽</div>
              <button class="expense-delete" onclick="handleDeleteExpense(${expense.id})">✕</button>
            </div>
          </div>
        `;
      });
    }
    document.getElementById('expensesList').innerHTML = expensesHtml;
  } catch (error) {
    console.error('Error loading booking details:', error);
  }
}
