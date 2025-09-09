let calendar;
let currentEventType = null;
let selectedEvent = null;
let allEvents = [];
let currentView = 'calendar';
let ganttData = [];

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 'auto',
        slotLabelFormat: {
            hour: 'numeric',
            minute: '2-digit',
            omitZeroMinute: false,
            meridiem: 'short'
        },
        eventTimeFormat: {
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
        },
        events: function(fetchInfo, successCallback, failureCallback) {
            // Get current filter settings
            const userFilter = document.getElementById('userFilter')?.value || 'all';
            const departmentFilter = document.getElementById('departmentFilter')?.value || 'all';
            
            // Build URL with filter parameters
            const params = new URLSearchParams({
                start: fetchInfo.startStr,
                end: fetchInfo.endStr
            });
            
            // Priority: user filter takes precedence over department filter
            if (userFilter !== 'all') {
                params.append('filter_type', 'individual');
                params.append('user_id', userFilter);
            } else if (departmentFilter !== 'all') {
                params.append('filter_type', 'department');
                params.append('department_id', departmentFilter);
            } else {
                params.append('filter_type', 'all');
            }
            
            fetch(`/api/events?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    allEvents = data;
                    updateTeamMemberCounts(data);
                    updateUserColorLegend(data);
                    successCallback(data);
                })
                .catch(error => {
                    console.error('Error fetching events:', error);
                    failureCallback(error);
                });
        },
        eventClick: function(info) {
            showEventDetails(info.event);
        },
        dateClick: function(info) {
            // Pre-fill date when clicking on calendar
            document.getElementById('eventDate').value = info.dateStr;
        },
        eventDidMount: function(info) {
            // Add tooltips to events
            info.el.setAttribute('title', info.event.title);
            
            // Add custom classes based on event type
            const eventType = info.event.extendedProps.type;
            const username = info.event.extendedProps.username;
            
            if (eventType) {
                info.el.classList.add(`calendar-event-${eventType}`);
            }
            
            // Add Gantt-style classes
            info.el.classList.add('gantt-style', 'user-event');
            
            // Set custom color as CSS variable
            if (info.event.color) {
                info.el.style.setProperty('--event-color', info.event.color);
            }
            
            // Add username data attribute for CSS ::after content
            if (username) {
                info.el.setAttribute('data-username', username.substring(0, 3).toUpperCase());
            }
            
            // Check if event spans multiple days
            const start = info.event.start;
            const end = info.event.end;
            
            if (start && end) {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > 1 || info.event.allDay) {
                    info.el.classList.add('multi-day');
                }
            }
            
            // Enhanced tooltip with user info
            const tooltipText = `${info.event.title}\nTime: ${info.event.start ? info.event.start.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : 'All Day'} - ${info.event.end ? info.event.end.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : 'All Day'}\nUser: ${username || 'Unknown'}`;
            info.el.setAttribute('title', tooltipText);
        },
        dayCellDidMount: function(info) {
            // Add team member info to each day cell
            addTeamMemberInfoToDay(info);
        },
        loading: function(isLoading) {
            // Show loading indicator
            const calendarContainer = document.querySelector('.card-body');
            if (isLoading) {
                calendarContainer.classList.add('loading');
            } else {
                calendarContainer.classList.remove('loading');
            }
        }
    });
    
    calendar.render();
    
    // Set up new filtering system
    setupCalendarFilters();
    
    // Initialize modal event handlers
    initializeModalHandlers();
});

function setupCalendarFilters() {
    const userFilter = document.getElementById('userFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    
    if (userFilter) {
        userFilter.addEventListener('change', function() {
            // When user filter changes, reset department filter to "all" and refresh
            if (this.value !== 'all' && departmentFilter) {
                departmentFilter.value = 'all';
            }
            filterCalendar();
        });
    }
    
    if (departmentFilter) {
        departmentFilter.addEventListener('change', function() {
            // When department filter changes, reset user filter to "all" and refresh
            if (this.value !== 'all' && userFilter) {
                userFilter.value = 'all';
            }
            filterCalendar();
        });
    }
}

function filterCalendar() {
    // Refresh based on current view
    if (currentView === 'calendar') {
        calendar.refetchEvents();
    } else if (currentView === 'gantt') {
        loadGanttChart();
    }
}

function initializeModalHandlers() {
    // Set up form submission
    document.getElementById('addEventForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addEvent();
    });
    
    // Pre-fill current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
    
    // Set default times from user profile or reasonable defaults
    setTimeSelectors('start', 9, 0, 'AM');
    setTimeSelectors('end', 5, 0, 'PM');
}

function showAddModal(eventType) {
    currentEventType = eventType;
    const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
    
    // Update modal title and show relevant fields
    const modalTitle = document.getElementById('modalTitle');
    const timeFields = document.getElementById('timeFields');
    const titleField = document.getElementById('titleField');
    const leaveTypeField = document.getElementById('leaveTypeField');
    const descriptionField = document.getElementById('descriptionField');
    
    // Reset form
    document.getElementById('addEventForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
    
    // Configure modal based on event type
    switch (eventType) {
        case 'availability':
            modalTitle.textContent = 'Add Availability';
            timeFields.style.display = 'block';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'none';
            setTimeSelectors('start', 9, 0, 'AM');
            setTimeSelectors('end', 5, 0, 'PM');
            break;
            
        case 'busy':
            modalTitle.textContent = 'Mark as Busy';
            timeFields.style.display = 'block';
            titleField.style.display = 'block';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'block';
            document.getElementById('eventTitle').value = 'Meeting';
            setTimeSelectors('start', 10, 0, 'AM');
            setTimeSelectors('end', 11, 0, 'AM');
            break;
            
        case 'leave':
            modalTitle.textContent = 'Request Leave';
            timeFields.style.display = 'none';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'block';
            descriptionField.style.display = 'block';
            document.getElementById('leaveType').value = 'Leave';
            break;
    }
    
    modal.show();
}

function addEvent() {
    const eventData = {
        date: document.getElementById('eventDate').value,
        type: currentEventType
    };
    
    // Add type-specific data
    switch (currentEventType) {
        case 'availability':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            break;
            
        case 'busy':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            eventData.title = document.getElementById('eventTitle').value || 'Busy';
            eventData.description = document.getElementById('eventDescription').value;
            break;
            
        case 'leave':
            eventData.leave_type = document.getElementById('leaveType').value;
            eventData.notes = document.getElementById('eventDescription').value;
            break;
    }
    
    // Validate required fields
    if (!eventData.date) {
        showAlert('Please select a date.', 'danger');
        return;
    }
    
    if ((currentEventType === 'availability' || currentEventType === 'busy') && 
        (!eventData.start_time || !eventData.end_time)) {
        showAlert('Please select start and end times.', 'danger');
        return;
    }
    
    if (currentEventType !== 'leave' && eventData.start_time >= eventData.end_time) {
        showAlert('End time must be after start time.', 'danger');
        return;
    }
    
    // Submit the event
    const endpoint = `/api/${currentEventType}`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(`${capitalizeFirst(currentEventType)} added successfully!`, 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    updateUserColorLegend(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while adding the event.', 'danger');
    });
}

// Unified Availability Modal Functions
function showUnifiedAvailabilityModal() {
    const modal = new bootstrap.Modal(document.getElementById('unifiedAvailabilityModal'));
    
    // Set default date for single day (today)
    const today = new Date();
    document.getElementById('singleEventDate').value = today.toISOString().split('T')[0];
    
    // Set default dates for multi-day (today to 2 weeks from today)
    const twoWeeksFromToday = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    document.getElementById('multiStartDate').value = today.toISOString().split('T')[0];
    document.getElementById('multiEndDate').value = twoWeeksFromToday.toISOString().split('T')[0];
    
    // Clear previous preview
    clearPreview();
    
    // Reset to single day tab
    const singleDayTab = document.getElementById('single-day-tab');
    const singleDayPane = document.getElementById('single-day-pane');
    const multiDayTab = document.getElementById('multi-day-tab');
    const multiDayPane = document.getElementById('multi-day-pane');
    
    singleDayTab.classList.add('active');
    multiDayTab.classList.remove('active');
    singleDayPane.classList.add('show', 'active');
    multiDayPane.classList.remove('show', 'active');
    
    modal.show();
}

function createAvailability() {
    // Check which tab is active
    const multiDayPane = document.getElementById('multi-day-pane');
    const isMultiDay = multiDayPane.classList.contains('active');
    
    if (isMultiDay) {
        createMultiDayAvailability();
    } else {
        createSingleDayAvailability();
    }
}

function createSingleDayAvailability() {
    const date = document.getElementById('singleEventDate').value;
    const startTime = getTimeFrom12HourSingle('singleStart');
    const endTime = getTimeFrom12HourSingle('singleEnd');
    
    if (!date || !startTime || !endTime) {
        showAlert('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showAlert('End time must be after start time.', 'warning');
        return;
    }
    
    // Prepare data for submission
    const eventData = {
        date: date,
        start_time: startTime,
        end_time: endTime,
        type: 'availability'
    };
    
    // Submit to backend
    fetch('/api/availability', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Availability added successfully!', 'success');
            
            // Refresh calendar
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    updateUserColorLegend(events);
                    calendar.refetchEvents();
                });
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('unifiedAvailabilityModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while adding availability.', 'danger');
    });
}

function getTimeFrom12HourSingle(prefix) {
    const hour = parseInt(document.getElementById(`${prefix}Hour`).value);
    const minute = document.getElementById(`${prefix}Minute`).value;
    const ampm = document.getElementById(`${prefix}AmPm`).value;
    
    if (!hour || !minute || !ampm) return null;
    
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) {
        hour24 += 12;
    } else if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute}`;
}

function generatePreview() {
    const startDate = document.getElementById('multiStartDate').value;
    const endDate = document.getElementById('multiEndDate').value;
    const startTime = getTimeFrom12HourMulti('multiStart');
    const endTime = getTimeFrom12HourMulti('multiEnd');
    
    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates.', 'warning');
        return;
    }
    
    if (!startTime || !endTime) {
        showAlert('Please select both start and end times.', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showAlert('End time must be after start time.', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showAlert('End date must be after start date.', 'warning');
        return;
    }
    
    // Get selected days
    const selectedDays = [];
    ['multiMonday', 'multiTuesday', 'multiWednesday', 'multiThursday', 'multiFriday', 'multiSaturday', 'multiSunday'].forEach(id => {
        if (document.getElementById(id).checked) {
            selectedDays.push(parseInt(document.getElementById(id).value));
        }
    });
    
    if (selectedDays.length === 0) {
        showAlert('Please select at least one day of the week.', 'warning');
        return;
    }
    
    // Generate timeline
    const previewContainer = document.getElementById('timelinePreview');
    const dates = generateDateRange(startDate, endDate, selectedDays);
    
    if (dates.length === 0) {
        previewContainer.innerHTML = `
            <div class="timeline-empty-state">
                <i class="fas fa-calendar-times fa-2x mb-2"></i>
                <p>No dates match your selected criteria</p>
            </div>
        `;
        return;
    }
    
    // Group dates by week for bar display
    const weekGroups = groupDatesByWeek(dates, startTime, endTime);
    
    const timelineHTML = `
        <div class="timeline-stats">
            <div class="timeline-stat">
                <span class="timeline-stat-number">${dates.length}</span>
                <div class="timeline-stat-label">Total Days</div>
            </div>
            <div class="timeline-stat">
                <span class="timeline-stat-number">${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}</span>
                <div class="timeline-stat-label">Time Range</div>
            </div>
            <div class="timeline-stat">
                <span class="timeline-stat-number">${calculateTotalHours(startTime, endTime, dates.length)} hrs</span>
                <div class="timeline-stat-label">Total Hours</div>
            </div>
        </div>
        <div class="gantt-timeline mt-4">
            <div class="gantt-header">
                <div class="gantt-time-label">Time</div>
                <div class="gantt-days-header">
                    <div class="gantt-day-label">Sun</div>
                    <div class="gantt-day-label">Mon</div>
                    <div class="gantt-day-label">Tue</div>
                    <div class="gantt-day-label">Wed</div>
                    <div class="gantt-day-label">Thu</div>
                    <div class="gantt-day-label">Fri</div>
                    <div class="gantt-day-label">Sat</div>
                </div>
            </div>
            ${weekGroups.map(week => `
                <div class="gantt-week-row">
                    <div class="gantt-week-label">
                        <div class="week-range">${week.startDate} - ${week.endDate}</div>
                        <div class="week-time">${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}</div>
                    </div>
                    <div class="gantt-week-days">
                        ${[0,1,2,3,4,5,6].map(dayIndex => `
                            <div class="gantt-day-cell ${week.days[dayIndex] ? 'has-availability' : ''}" 
                                 data-date="${week.days[dayIndex] || ''}"
                                 title="${week.days[dayIndex] ? formatDateDisplay(week.days[dayIndex]) + ' - Available' : 'Not selected'}">
                                ${week.days[dayIndex] ? '<div class="availability-bar"></div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    previewContainer.innerHTML = timelineHTML;
}

function clearPreview() {
    const previewContainer = document.getElementById('timelinePreview');
    previewContainer.innerHTML = `
        <div class="text-center text-muted p-4">
            <i class="fas fa-calendar-plus fa-2x mb-2"></i>
            <p>Select your date range and click "Generate Preview" to see the timeline</p>
        </div>
    `;
}

function createMultiDayAvailability() {
    const startDate = document.getElementById('multiStartDate').value;
    const endDate = document.getElementById('multiEndDate').value;
    const startTime = getTimeFrom12HourMulti('multiStart');
    const endTime = getTimeFrom12HourMulti('multiEnd');
    
    if (!startDate || !endDate || !startTime || !endTime) {
        showAlert('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showAlert('End time must be after start time.', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showAlert('End date must be after start date.', 'warning');
        return;
    }
    
    // Get selected days
    const selectedDays = [];
    ['multiMonday', 'multiTuesday', 'multiWednesday', 'multiThursday', 'multiFriday', 'multiSaturday', 'multiSunday'].forEach(id => {
        if (document.getElementById(id).checked) {
            selectedDays.push(parseInt(document.getElementById(id).value));
        }
    });
    
    if (selectedDays.length === 0) {
        showAlert('Please select at least one day of the week.', 'warning');
        return;
    }
    
    // Generate date range
    const dates = generateDateRange(startDate, endDate, selectedDays);
    
    if (dates.length === 0) {
        showAlert('No dates match your selected criteria.', 'warning');
        return;
    }
    
    // Prepare data for submission
    const eventData = {
        dates: dates.map(d => d.date),
        start_time: startTime,
        end_time: endTime,
        type: 'multi_availability'
    };
    
    // Submit to backend
    fetch('/api/multi-availability', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(`Successfully created availability for ${dates.length} days!`, 'success');
            
            // Refresh calendar
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    updateUserColorLegend(events);
                    calendar.refetchEvents();
                });
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('unifiedAvailabilityModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while creating multi-day availability.', 'danger');
    });
}

// Helper functions for multi-day availability
function generateDateRange(startDateStr, endDateStr, selectedDays) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const dates = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const current = new Date(startDate);
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (selectedDays.includes(dayOfWeek)) {
            dates.push({
                date: current.toISOString().split('T')[0],
                weekday: weekdays[dayOfWeek]
            });
        }
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

function getTimeFrom12HourMulti(prefix) {
    const hour = parseInt(document.getElementById(`${prefix}Hour`).value);
    const minute = document.getElementById(`${prefix}Minute`).value;
    const ampm = document.getElementById(`${prefix}AmPm`).value;
    
    if (!hour || !minute || !ampm) return null;
    
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) {
        hour24 += 12;
    } else if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute}`;
}

function formatTime12Hour(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function calculateTotalHours(startTime, endTime, numDays) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    const hoursPerDay = durationMinutes / 60;
    
    return (hoursPerDay * numDays).toFixed(1);
}

function groupDatesByWeek(dates, startTime, endTime) {
    if (dates.length === 0) return [];
    
    const weeks = [];
    let currentWeek = null;
    
    dates.forEach(dateObj => {
        const date = new Date(dateObj.date);
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        const weekKey = sunday.toISOString().split('T')[0];
        
        if (!currentWeek || currentWeek.weekKey !== weekKey) {
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            
            currentWeek = {
                weekKey: weekKey,
                startDate: sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                endDate: saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                days: [null, null, null, null, null, null, null] // Sun, Mon, Tue, Wed, Thu, Fri, Sat
            };
            weeks.push(currentWeek);
        }
        
        const dayOfWeek = date.getDay();
        currentWeek.days[dayOfWeek] = dateObj.date;
    });
    
    return weeks;
}

function showEventDetails(event) {
    selectedEvent = event;
    const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
    const detailsContainer = document.getElementById('eventDetails');
    
    let html = `
        <div class="mb-3">
            <h5>${event.title}</h5>
            <p class="text-muted mb-1">
                <i class="fas fa-calendar me-2"></i>
                ${formatDate(event.start)}
            </p>
    `;
    
    if (!event.allDay) {
        html += `
            <p class="text-muted mb-1">
                <i class="fas fa-clock me-2"></i>
                ${formatTime(event.start)} - ${formatTime(event.end)}
            </p>
        `;
    }
    
    if (event.extendedProps.description) {
        html += `
            <p class="mt-3">
                <strong>Description:</strong><br>
                ${event.extendedProps.description}
            </p>
        `;
    }
    
    if (event.extendedProps.notes) {
        html += `
            <p class="mt-3">
                <strong>Notes:</strong><br>
                ${event.extendedProps.notes}
            </p>
        `;
    }
    
    // Show edit and delete buttons only for current user's events or if admin
    const editBtn = document.getElementById('editEventBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const currentUserId = window.currentUser ? window.currentUser.id : 0;
    const isAdmin = window.currentUser ? window.currentUser.is_admin : false;
    
    if (event.extendedProps.user_id === currentUserId || isAdmin) {
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
    } else {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }
    
    html += '</div>';
    detailsContainer.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    detailsContainer.appendChild(tempDiv);
    modal.show();
}

function deleteEvent() {
    if (!selectedEvent) return;
    
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }
    
    const eventId = selectedEvent.id;
    const eventType = selectedEvent.extendedProps.type;
    const actualId = eventId.split('-')[1]; // Remove prefix like 'avail-', 'busy-', 'leave-'
    
    fetch(`/api/events/${eventType}/${actualId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Event deleted successfully!', 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    updateUserColorLegend(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while deleting the event.', 'danger');
    });
}

function editEvent() {
    if (!selectedEvent) return;
    
    // Close the details modal
    bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
    
    // Determine event type from the ID prefix
    const eventId = selectedEvent.id;
    const eventType = selectedEvent.extendedProps.type;
    
    // Set up the modal for editing
    const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
    const modalTitle = document.getElementById('modalTitle');
    const timeFields = document.getElementById('timeFields');
    const titleField = document.getElementById('titleField');
    const leaveTypeField = document.getElementById('leaveTypeField');
    const descriptionField = document.getElementById('descriptionField');
    
    // Set current event type for editing
    currentEventType = eventType;
    
    // Pre-fill the form with current event data
    document.getElementById('eventDate').value = selectedEvent.start.toISOString().split('T')[0];
    
    // Configure modal based on event type
    switch (eventType) {
        case 'availability':
            modalTitle.textContent = 'Edit Availability';
            timeFields.style.display = 'block';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'none';
            
            // Set times for availability
            if (selectedEvent.start && selectedEvent.end) {
                setTimeSelectorsFromDate('start', selectedEvent.start);
                setTimeSelectorsFromDate('end', selectedEvent.end);
            }
            break;
            
        case 'busy':
            modalTitle.textContent = 'Edit Busy Period';
            timeFields.style.display = 'block';
            titleField.style.display = 'block';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'block';
            
            // Set times and details for busy slot
            if (selectedEvent.start && selectedEvent.end) {
                setTimeSelectorsFromDate('start', selectedEvent.start);
                setTimeSelectorsFromDate('end', selectedEvent.end);
            }
            
            // Extract title (remove username prefix)
            const titleParts = selectedEvent.title.split(' - ');
            document.getElementById('eventTitle').value = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : titleParts[0];
            document.getElementById('eventDescription').value = selectedEvent.extendedProps.description || '';
            break;
            
        case 'leave':
            modalTitle.textContent = 'Edit Leave Request';
            timeFields.style.display = 'none';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'block';
            descriptionField.style.display = 'block';
            
            // Extract leave type from title
            const leaveTitleParts = selectedEvent.title.split(' - ');
            const leaveType = leaveTitleParts.length > 1 ? leaveTitleParts[1] : 'Leave';
            document.getElementById('leaveType').value = leaveType;
            document.getElementById('eventDescription').value = selectedEvent.extendedProps.notes || '';
            break;
    }
    
    // Change the button text to indicate editing
    const submitBtn = document.querySelector('#addEventModal .btn-primary');
    submitBtn.textContent = 'Update Event';
    submitBtn.onclick = updateEvent;
    
    modal.show();
}

function updateEvent() {
    const eventData = {
        date: document.getElementById('eventDate').value,
        type: currentEventType
    };
    
    // Add type-specific data
    switch (currentEventType) {
        case 'availability':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            break;
            
        case 'busy':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            eventData.title = document.getElementById('eventTitle').value || 'Busy';
            eventData.description = document.getElementById('eventDescription').value;
            break;
            
        case 'leave':
            eventData.leave_type = document.getElementById('leaveType').value;
            eventData.notes = document.getElementById('eventDescription').value;
            break;
    }
    
    // Validate required fields
    if (!eventData.date) {
        showAlert('Please select a date.', 'danger');
        return;
    }
    
    if ((currentEventType === 'availability' || currentEventType === 'busy') && 
        (!eventData.start_time || !eventData.end_time)) {
        showAlert('Please select start and end times.', 'danger');
        return;
    }
    
    if (currentEventType !== 'leave' && eventData.start_time >= eventData.end_time) {
        showAlert('End time must be after start time.', 'danger');
        return;
    }
    
    // Extract the actual ID from the selected event
    const actualId = selectedEvent.id.split('-')[1];
    const endpoint = `/api/events/${currentEventType}/${actualId}`;
    
    fetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(`${capitalizeFirst(currentEventType)} updated successfully!`, 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    updateUserColorLegend(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
            
            // Reset the button back to "Add Event"
            const submitBtn = document.querySelector('#addEventModal .btn-primary');
            submitBtn.textContent = 'Add Event';
            submitBtn.onclick = addEvent;
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while updating the event.', 'danger');
    });
}

// Helper functions for 12-hour time handling
function setTimeSelectors(prefix, hour, minute, ampm) {
    document.getElementById(`${prefix}Hour`).value = hour.toString();
    document.getElementById(`${prefix}Minute`).value = minute.toString().padStart(2, '0');
    document.getElementById(`${prefix}AmPm`).value = ampm;
}

function setTimeSelectorsFromDate(prefix, date) {
    let hour = date.getHours();
    const minute = date.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    if (hour === 0) hour = 12;
    else if (hour > 12) hour = hour - 12;
    
    setTimeSelectors(prefix, hour, minute, ampm);
}

function getTimeFrom12Hour(prefix) {
    const hour = parseInt(document.getElementById(`${prefix}Hour`).value);
    const minute = parseInt(document.getElementById(`${prefix}Minute`).value);
    const ampm = document.getElementById(`${prefix}AmPm`).value;
    
    if (!hour) return null;
    
    let hour24 = hour;
    if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
    } else if (ampm === 'PM' && hour !== 12) {
        hour24 = hour + 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Utility functions
function showAlert(message, type) {
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    alert.appendChild(messageSpan);
    alert.appendChild(closeBtn);
    
    // Insert after the first child (usually the nav container)
    const firstCard = alertContainer.querySelector('.row');
    if (firstCard) {
        alertContainer.insertBefore(alert, firstCard);
    } else {
        alertContainer.insertBefore(alert, alertContainer.firstChild);
    }
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert && alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Update user color legend
function updateUserColorLegend(events) {
    const legendContainer = document.getElementById('userColorLegend');
    if (!legendContainer) return;

    // Extract unique users with their colors
    const userColors = new Map();
    events.forEach(event => {
        if (event.username && event.color && !userColors.has(event.username)) {
            userColors.set(event.username, event.color);
        }
    });

    // Clear existing legend
    legendContainer.innerHTML = '';

    // Add legend entries
    userColors.forEach((color, username) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item d-flex align-items-center';
        legendItem.innerHTML = `
            <div class="legend-color me-2" 
                 style="width: 16px; height: 16px; background-color: ${color}; border: 2px solid ${color}; border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></div>
            <span class="legend-text" style="font-size: 0.875em; font-weight: 500;">${username}</span>
        `;
        legendContainer.appendChild(legendItem);
    });

    if (userColors.size === 0) {
        legendContainer.innerHTML = '<span class="text-muted">No events to display colors for</span>';
    }
}

// Switch between calendar and gantt views
function switchView(viewType) {
    currentView = viewType;
    
    const calendarView = document.getElementById('calendar');
    const ganttView = document.getElementById('ganttChart');
    const calendarBtn = document.getElementById('calendarViewBtn');
    const ganttBtn = document.getElementById('ganttViewBtn');
    
    if (viewType === 'calendar') {
        calendarView.style.display = 'block';
        ganttView.style.display = 'none';
        calendarBtn.classList.add('active');
        ganttBtn.classList.remove('active');
    } else {
        calendarView.style.display = 'none';
        ganttView.style.display = 'block';
        calendarBtn.classList.remove('active');
        ganttBtn.classList.add('active');
        
        // Load Gantt chart data
        loadGanttChart();
    }
}

// Load and render Gantt chart
function loadGanttChart() {
    // Get current filter settings
    const userFilter = document.getElementById('userFilter')?.value || 'all';
    const departmentFilter = document.getElementById('departmentFilter')?.value || 'all';
    
    // Build URL with filter parameters
    const params = new URLSearchParams();
    
    // Priority: user filter takes precedence over department filter
    if (userFilter !== 'all') {
        params.append('filter_type', 'individual');
        params.append('user_id', userFilter);
    } else if (departmentFilter !== 'all') {
        params.append('filter_type', 'department');
        params.append('department_id', departmentFilter);
    } else {
        params.append('filter_type', 'all');
    }
    
    fetch(`/api/gantt-data?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            ganttData = data;
            renderGanttChart(data);
        })
        .catch(error => {
            console.error('Error loading Gantt data:', error);
        });
}

// Render the Gantt chart
function renderGanttChart(data) {
    const timelineHeader = document.getElementById('ganttTimelineHeader');
    const sidebar = document.getElementById('ganttSidebar');
    const timeline = document.getElementById('ganttTimeline');
    
    // Clear existing content
    timelineHeader.innerHTML = '';
    sidebar.innerHTML = '';
    timeline.innerHTML = '';
    
    // Generate timeline headers (months for 6 months)
    const startDate = new Date();
    startDate.setDate(1); // Start of current month
    
    const months = [];
    for (let i = 0; i < 6; i++) {
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push(monthStart);
    }
    
    // Create month headers
    months.forEach((month, index) => {
        const monthHeader = document.createElement('div');
        monthHeader.className = 'gantt-month-header';
        
        // Create month title
        const monthTitle = document.createElement('div');
        monthTitle.className = 'gantt-month-title';
        monthTitle.textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Create date range subtitle
        const dateRange = document.createElement('div');
        dateRange.className = 'gantt-month-subtitle';
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        dateRange.textContent = `${month.getDate()}-${lastDay}`;
        
        monthHeader.appendChild(monthTitle);
        monthHeader.appendChild(dateRange);
        timelineHeader.appendChild(monthHeader);
    });
    
    // Render user rows
    data.users.forEach(user => {
        // Sidebar user row
        const userRow = document.createElement('div');
        userRow.className = 'gantt-user-row';
        userRow.innerHTML = `
            <div class="gantt-user-color" style="background-color: ${user.color};"></div>
            <span>${user.username}</span>
        `;
        sidebar.appendChild(userRow);
        
        // Timeline row
        const timelineRow = document.createElement('div');
        timelineRow.className = 'gantt-timeline-row';
        
        // Create month cells
        months.forEach((month, monthIndex) => {
            const monthCell = document.createElement('div');
            monthCell.className = 'gantt-month-cell';
            
            timelineRow.appendChild(monthCell);
        });
        
        timeline.appendChild(timelineRow);
        
        // Add events as bars
        user.events.forEach(event => {
            createGanttBar(timelineRow, event, months, user.color);
        });
    });
}

// Create a Gantt bar for an event
function createGanttBar(timelineRow, event, months, userColor) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end || event.start);
    
    // Find which month cells this event spans
    let startMonthIndex = -1;
    let endMonthIndex = -1;
    
    months.forEach((month, index) => {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0); // Last day of month
        
        if (eventStart <= monthEnd && eventStart.getMonth() === month.getMonth() && eventStart.getFullYear() === month.getFullYear() && startMonthIndex === -1) {
            startMonthIndex = index;
        }
        if (eventEnd <= monthEnd && eventEnd.getMonth() === month.getMonth() && eventEnd.getFullYear() === month.getFullYear()) {
            endMonthIndex = index;
        }
    });
    
    if (startMonthIndex === -1) return;
    if (endMonthIndex === -1) endMonthIndex = startMonthIndex;
    
    // Calculate position and width
    const startCell = timelineRow.children[startMonthIndex];
    const endCell = timelineRow.children[endMonthIndex];
    
    if (!startCell || !endCell) return;
    
    const bar = document.createElement('div');
    bar.className = `gantt-bar ${event.type}`;
    bar.style.setProperty('--bar-color', userColor);
    
    // Format the date display
    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : startDate;
    
    let dateText = '';
    if (event.type === 'leave') {
        // For leave days, just show the date
        dateText = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
        // For availability and busy slots, show date and time
        if (startDate.toDateString() === endDate.toDateString()) {
            // Same day
            dateText = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        } else {
            // Multiple days
            dateText = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
    }
    
    bar.textContent = dateText;
    
    // Enhanced tooltip with full details
    const eventType = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    bar.title = `${eventType}\nDate: ${event.start}${event.end && event.end !== event.start ? ' - ' + event.end : ''}\nUser: ${event.title.split(' - ')[0]}`;
    
    // Position the bar using percentage-based positioning with more precise placement
    const cellWidth = 100 / 6; // 6 months total, each gets equal percentage
    const startOffset = startMonthIndex * cellWidth;
    let width = (endMonthIndex - startMonthIndex + 1) * cellWidth;
    
    // Position the bar in the correct month cell
    bar.style.left = `${startOffset + 2}%`; // Add small margin from cell start
    bar.style.width = `${Math.max(width - 4, 8)}%`; // Ensure minimum width
    bar.style.top = '10px'; // Position from top of row
    bar.style.position = 'absolute';
    
    timelineRow.appendChild(bar);
}

// Get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Update team member status counters
function updateTeamMemberCounts(events) {
    // Reset all counters
    document.querySelectorAll('[id^="available-"], [id^="busy-"], [id^="leave-"]').forEach(el => {
        el.textContent = '0 ' + el.textContent.split(' ').slice(1).join(' ');
    });
    
    // Count events by user and type
    const counts = {};
    events.forEach(event => {
        const userId = event.user_id;
        const type = event.type;
        
        if (!counts[userId]) {
            counts[userId] = { availability: 0, busy: 0, leave: 0 };
        }
        counts[userId][type]++;
    });
    
    // Update the display
    Object.keys(counts).forEach(userId => {
        const availableEl = document.getElementById(`available-${userId}`);
        const busyEl = document.getElementById(`busy-${userId}`);
        const leaveEl = document.getElementById(`leave-${userId}`);
        
        if (availableEl) availableEl.textContent = `${counts[userId].availability} Available`;
        if (busyEl) busyEl.textContent = `${counts[userId].busy} Busy`;
        if (leaveEl) leaveEl.textContent = `${counts[userId].leave} Leave`;
    });
}

// Add team member info to calendar day cells
function addTeamMemberInfoToDay(info) {
    const dateStr = info.date.toISOString().split('T')[0];
    const dayEvents = allEvents.filter(event => 
        event.start.startsWith(dateStr) || event.start === dateStr
    );
    
    if (dayEvents.length > 0) {
        const teamInfo = document.createElement('div');
        teamInfo.className = 'team-day-info mt-1';
        
        // Group events by user
        const userEvents = {};
        dayEvents.forEach(event => {
            const userName = event.title.split(' - ')[0];
            if (!userEvents[userName]) {
                userEvents[userName] = [];
            }
            userEvents[userName].push(event);
        });
        
        // Create mini status indicators
        Object.keys(userEvents).slice(0, 3).forEach(userName => {
            const userEvent = userEvents[userName][0]; // Take first event for this user
            const type = userEvent.type;
            let color = '#6c757d';
            let icon = 'circle';
            
            if (type === 'availability') {
                color = '#28a745';
                icon = 'check-circle';
            } else if (type === 'busy') {
                color = '#dc3545';
                icon = 'times-circle';
            } else if (type === 'leave') {
                color = '#ffc107';
                icon = 'calendar-times';
            }
            
            const indicator = document.createElement('div');
            indicator.className = 'mini-indicator d-flex align-items-center mb-1';
            const iconEl = document.createElement('i');
            iconEl.className = `fas fa-${icon} me-1`;
            iconEl.style.cssText = `color: ${color}; font-size: 0.7em;`;
            const spanEl = document.createElement('span');
            spanEl.textContent = userName.split(' ')[0];
            spanEl.style.cssText = `font-size: 0.65em; color: ${color};`;
            indicator.appendChild(iconEl);
            indicator.appendChild(spanEl);
            teamInfo.appendChild(indicator);
        });
        
        if (Object.keys(userEvents).length > 3) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'mini-indicator';
            const smallEl = document.createElement('small');
            smallEl.textContent = `+${Object.keys(userEvents).length - 3} more`;
            smallEl.style.cssText = 'font-size: 0.6em; color: #6c757d;';
            moreIndicator.appendChild(smallEl);
            teamInfo.appendChild(moreIndicator);
        }
        
        info.el.appendChild(teamInfo);
    }
}

// Live team status functionality
function loadLiveTeamStatus() {
    // Only load if the live status container exists (on calendar page)
    if (!document.getElementById('liveTeamStatus')) return;
    
    // For non-admin users, create a simpler endpoint that doesn't expose detailed team info
    const endpoint = window.currentUser && window.currentUser.is_admin ? 
        '/api/team/status' : '/api/team/public-status';
    
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateLiveStatusDisplay(data.team_status || data.public_status || []);
                updateStatusTimestamp();
            } else {
                console.error('Error loading live status:', data.error);
                showOfflineStatus();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showOfflineStatus();
        });
}

function updateLiveStatusDisplay(teamStatus) {
    const container = document.getElementById('liveTeamStatus');
    const onlineCountElement = document.getElementById('onlineCount');
    
    if (!container) return;
    
    const workingMembers = teamStatus.filter(member => member.is_working || member.is_clocked_in);
    
    // Update online count
    if (onlineCountElement) {
        onlineCountElement.textContent = workingMembers.length;
    }
    
    if (workingMembers.length === 0) {
        container.textContent = '';
        const noWorkDiv = document.createElement('div');
        noWorkDiv.className = 'text-muted d-flex align-items-center';
        const moonIcon = document.createElement('i');
        moonIcon.className = 'fas fa-moon me-2';
        const noWorkSpan = document.createElement('span');
        noWorkSpan.textContent = 'No one is currently working';
        noWorkDiv.appendChild(moonIcon);
        noWorkDiv.appendChild(noWorkSpan);
        container.appendChild(noWorkDiv);
        return;
    }
    
    let html = '';
    workingMembers.forEach(member => {
        const statusColor = getStatusColor(member.status_message);
        const durationText = getDurationText(member);
        
        html += `
            <div class="d-inline-flex align-items-center bg-dark rounded-pill px-3 py-2 me-2 mb-2" style="border: 1px solid var(--bs-${statusColor});">
                <div class="status-dot bg-${statusColor} rounded-circle me-2" style="width: 8px; height: 8px;"></div>
                <div class="d-flex flex-column">
                    <strong class="small">${member.username}</strong>
                    <small class="text-${statusColor}">${member.status_message || (member.is_clocked_in ? 'Working' : 'Offline')}</small>
                    ${member.current_task ? `<small class="text-muted">${member.current_task}</small>` : ''}
                    ${durationText ? `<small class="text-info">${durationText}</small>` : ''}
                </div>
            </div>
        `;
    });
    
    container.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'Available': return 'success';
        case 'In Meeting': return 'warning';
        case 'Busy': return 'danger';
        case 'On Break': return 'info';
        case 'Away': return 'secondary';
        default: return 'success';
    }
}

function getDurationText(member) {
    if (!member.current_duration || member.current_duration <= 0) return '';
    
    const hours = Math.floor(member.current_duration / 60);
    const minutes = Math.floor(member.current_duration % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function updateStatusTimestamp() {
    const element = document.getElementById('statusLastUpdated');
    if (element) {
        const now = new Date();
        element.textContent = `Updated: ${now.toLocaleTimeString()}`;
    }
}

function showOfflineStatus() {
    const container = document.getElementById('liveTeamStatus');
    const onlineCountElement = document.getElementById('onlineCount');
    
    if (container) {
        container.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-muted d-flex align-items-center';
        const errorIcon = document.createElement('i');
        errorIcon.className = 'fas fa-exclamation-triangle me-2';
        const errorSpan = document.createElement('span');
        errorSpan.textContent = 'Unable to load team status';
        errorDiv.appendChild(errorIcon);
        errorDiv.appendChild(errorSpan);
        container.appendChild(errorDiv);
    }
    
    if (onlineCountElement) {
        onlineCountElement.textContent = '0';
    }
}

// Add current user data to body for JavaScript access
document.addEventListener('DOMContentLoaded', function() {
    // This is now populated by the backend template in calendar.html
    if (typeof window.currentUser !== 'undefined') {
        document.body.dataset.currentUserId = window.currentUser.id;
        document.body.dataset.isAdmin = window.currentUser.is_admin;
        console.log('Current user loaded:', window.currentUser);
    }
    
    // Load and refresh live team status on calendar page
    if (document.getElementById('liveTeamStatus')) {
        loadLiveTeamStatus();
        setInterval(loadLiveTeamStatus, 30000); // Refresh every 30 seconds
    }
});
