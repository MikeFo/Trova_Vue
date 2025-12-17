<template>
  <div class="calendar-grid-container">
    <!-- Month Navigation -->
    <div class="calendar-header">
      <ion-button fill="clear" @click="previousMonth" class="nav-button">
        <ion-icon :icon="chevronBack"></ion-icon>
      </ion-button>
      <h2 class="month-year">{{ monthYear }}</h2>
      <ion-button fill="clear" @click="nextMonth" class="nav-button">
        <ion-icon :icon="chevronForward"></ion-icon>
      </ion-button>
    </div>

    <!-- Day Headers -->
    <div class="day-headers">
      <div v-for="day in dayNames" :key="day" class="day-header">
        {{ day }}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'selected': day.date && isSelected(day.date),
          'has-events': day.events && day.events.length > 0,
          'today': day.isToday
        }"
        @click="selectDay(day)"
      >
        <div class="day-number">{{ day.day }}</div>
        <div v-if="day.events && day.events.length > 0" class="day-events">
          <div
            v-for="(event, eventIndex) in getVisibleEvents(day.events)"
            :key="event.id"
            class="event-dot"
            :style="{ backgroundColor: getEventColor(event) }"
            :title="event.name"
          ></div>
          <div
            v-if="day.events.length > 2"
            class="more-events"
            @click.stop="viewAllEvents(day)"
          >
            See all {{ day.events.length }} events
          </div>
        </div>
        <ion-button
          fill="clear"
          class="create-event-button"
          @click.stop="createEvent(day.date)"
        >
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { chevronBack, chevronForward, addOutline } from 'ionicons/icons';
import type { Event } from '@/services/event.service';

interface CalendarDay {
  day: number | null;
  date: Date | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  events?: Event[];
}

interface Props {
  selectedDate?: Date;
  events?: Event[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: () => new Date(),
  events: () => [],
});

const emit = defineEmits<{
  'day-selected': [date: Date];
  'create-event': [date: Date];
  'view-events': [date: Date, events: Event[]];
}>();

const currentDate = ref(new Date(props.selectedDate));
const selectedDay = ref<Date | null>(props.selectedDate || null);

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
});

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  
  // First day of the month
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Previous month's days to show
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();
  
  const days: CalendarDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i);
    if (!isNaN(date.getTime())) {
      days.push({
        day: daysInPrevMonth - i,
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      days.push({
        day,
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }
  }
  
  // Next month days to fill the grid (42 total cells for 6 weeks)
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    if (!isNaN(date.getTime())) {
      days.push({
        day,
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }
  }
  
  return days;
});

function getEventsForDate(date: Date): Event[] {
  if (!props.events || props.events.length === 0) return [];
  if (!date || isNaN(date.getTime())) return [];
  
  const dateStr = date.toISOString().split('T')[0];
  return props.events.filter((event) => {
    if (!event.startTime) return false;
    const eventDate = new Date(event.startTime);
    if (isNaN(eventDate.getTime())) return false;
    const eventDateStr = eventDate.toISOString().split('T')[0];
    return eventDateStr === dateStr;
  });
}

function getVisibleEvents(events: Event[]): Event[] {
  return events.slice(0, 2);
}

function getEventColor(event: Event): string {
  // Use different colors for different event types or groups
  return 'var(--color-primary)';
}

function isSelected(date: Date | null): boolean {
  if (!date || !selectedDay.value) return false;
  return date.toDateString() === selectedDay.value.toDateString();
}

function selectDay(day: CalendarDay) {
  if (!day.date) return;
  
  if (selectedDay.value && day.date.toDateString() === selectedDay.value.toDateString()) {
    // Deselect if clicking the same day
    selectedDay.value = null;
    emit('day-selected', day.date);
  } else {
    selectedDay.value = day.date;
    emit('day-selected', day.date);
  }
}

function createEvent(date: Date | null) {
  if (!date) return;
  emit('create-event', date);
}

function viewAllEvents(day: CalendarDay) {
  if (!day.date || !day.events) return;
  emit('view-events', day.date, day.events);
}

function previousMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  );
}

function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  );
}
</script>

<style scoped>
.calendar-grid-container {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f3f4f6;
}

.month-year {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.3px;
}

.nav-button {
  --color: var(--color-primary);
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.nav-button ion-icon {
  font-size: 20px;
}

.day-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.day-header {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  padding: 10px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.calendar-day {
  aspect-ratio: 1;
  min-height: 60px;
  max-height: 60px;
  border-radius: 10px;
  padding: 6px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  background: #ffffff;
}

.calendar-day:hover {
  background: #f9fafb;
  border-color: #e5e7eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.calendar-day.other-month {
  opacity: 0.4;
  background: #f9fafb;
}

.calendar-day.selected {
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(45, 122, 78, 0.1);
}

.calendar-day.today {
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.08) 0%, rgba(29, 185, 138, 0.08) 100%);
  border-color: var(--color-primary);
}

.calendar-day.today .day-number {
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-number {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.day-events {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 3px;
  width: 100%;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  padding-top: 2px;
}

.event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.more-events {
  font-size: 9px;
  color: var(--color-primary);
  font-weight: 600;
  text-align: center;
  padding: 2px 6px;
  background: rgba(45, 122, 78, 0.12);
  border-radius: 6px;
  cursor: pointer;
  margin-top: 2px;
  transition: all 0.2s ease;
}

.more-events:hover {
  background: rgba(45, 122, 78, 0.2);
}

.create-event-button {
  position: absolute;
  top: 4px;
  right: 4px;
  --padding-start: 4px;
  --padding-end: 4px;
  --color: var(--color-primary);
  margin: 0;
  opacity: 0;
  transition: all 0.2s ease;
  width: 24px;
  height: 24px;
  --background: rgba(255, 255, 255, 0.9);
  --border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.calendar-day:hover .create-event-button {
  opacity: 1;
}

.create-event-button:hover {
  --background: var(--color-primary);
  --color: white;
  transform: scale(1.1);
}

.create-event-button ion-icon {
  font-size: 14px;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .calendar-grid-container {
    padding: 24px;
  }

  .calendar-day {
    min-height: 70px;
    max-height: 70px;
    padding: 8px;
  }

  .day-number {
    font-size: 15px;
  }

  .event-dot {
    width: 7px;
    height: 7px;
  }

  .month-year {
    font-size: 24px;
  }
}
</style>

