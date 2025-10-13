let currentData = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    loadUsers();
    loadAnalytics();
    
    // Set up event listeners
    document.getElementById('loadAnalyticsBtn').addEventListener('click', loadAnalytics);
    document.getElementById('refreshDataBtn').addEventListener('click', loadAnalytics);
    document.getElementById('exportDataBtn').addEventListener('click', exportToCSV);
    document.getElementById('quickDateRange').addEventListener('change', handleQuickDateRange);
});

function initializePage() {
    // Set default date range to current month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('startDate').value = startOfMonth.toISOString().split('T')[0];
    document.getElementById('endDate').value = endOfMonth.toISOString().split('T')[0];
}

function loadUsers() {
    // Only load users if admin
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;
    
    fetch('/api/users')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                userSelect.innerHTML = '<option value="">All Users</option>';
                data.users.forEach(user => {
                    userSelect.innerHTML += `<option value="${user.id}">${user.username}</option>`;
                });

            }
        })
        .catch(error => console.error('Error loading users:', error));
}

function handleQuickDateRange() {
    const quickSelect = document.getElementById('quickDateRange');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    const today = new Date();
    let start, end;
    
    switch (quickSelect.value) {
        case 'current_month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_month':
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'current_quarter':
            const quarter = Math.floor(today.getMonth() / 3);
            start = new Date(today.getFullYear(), quarter * 3, 1);
            end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
            break;
        case 'last_quarter':
            const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
            const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
            const qStart = lastQuarter < 0 ? 3 : lastQuarter;
            start = new Date(year, qStart * 3, 1);
            end = new Date(year, qStart * 3 + 3, 0);
            break;
        case 'current_year':
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            break;
        default:
            return;
    }
    
    startDate.value = start.toISOString().split('T')[0];
    endDate.value = end.toISOString().split('T')[0];
}

function loadAnalytics() {
    const params = new URLSearchParams();
    
    const userSelect = document.getElementById('userSelect');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (userSelect && userSelect.value) {
        params.append('user_id', userSelect.value);
    }
    if (startDate) {
        params.append('start_date', startDate);
    }
    if (endDate) {
        params.append('end_date', endDate);
    }
    
    // Show loading
    document.getElementById('availabilityTableBody').innerHTML = `
        <tr>
            <td colspan="7" class="text-center text-muted">
                <div class="spinner-border spinner-border-sm me-2"></div>
                Loading availability data...
            </td>
        </tr>
    `;
    
    fetch(`/api/availability/analytics?${params}`)
        .then(response => response.json())
        .then(data => {
            console.log('Analytics API Response:', data); // Debug log
            if (data.success) {
                currentData = data.data;
                updateSummaryStats(data.analytics);
                updateAvailabilityTable(data.data);
                document.getElementById('dataCount').textContent = `${data.data.length} entries`;
            } else {
                console.error('Analytics API Error:', data.error);
                showAlert('Error loading analytics: ' + data.error, 'danger');
                updateAvailabilityTable([]);
            }
        })
        .catch(error => {
            console.error('Analytics fetch failed:', error.message || error);
            showAlert('Failed to load availability analytics', 'danger');
            updateAvailabilityTable([]);
        });
}

function updateSummaryStats(analytics) {
    console.log('Updating summary stats:', analytics); // Debug log
    
    const elements = {
        'totalAvailabilityHours': analytics.total_availability_hours || 0,
        'totalBusyHours': analytics.total_busy_hours || 0,
        'totalLeaveDays': analytics.total_leave_days || 0,
        'totalScheduledDays': analytics.total_scheduled_days || 0,
        'availabilityRate': (analytics.availability_rate || 0) + '%'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element with ID '${id}' not found`);
        }
    }
}

function updateAvailabilityTable(data) {
    const tbody = document.getElementById('availabilityTableBody');
    console.log('Updating table with data:', data.length, 'entries'); // Debug log
    
    if (!tbody) {
        console.error('Table body element not found!');
        return;
    }
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No availability data found</td></tr>';
        return;
    }
    
    let html = '';
    data.forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString();
        const end_date = new Date(entry.end_date).toLocaleDateString();
        
        const statusClass = getStatusClass(entry.type);
        const statusBadge = `<span class="badge bg-${statusClass}">${entry.status}</span>`;
        
        html += `
            <tr>
                <td>${date}</td>
                <td>${end_date}</td>
                <td>${entry.username}</td>
                <td style="text-transform: capitalize;">${entry.type}</td>
                <td>${entry.start_time || '--'}</td>
                <td>${entry.end_time || '--'}</td>
                <td>${statusBadge}</td>
                <td>${entry.notes || '--'}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    console.log('Table updated successfully with', data.length, 'rows');
}

function getStatusClass(type) {
    switch (type) {
        case 'availability':
            return 'success';
        case 'busy':
            return 'warning';
        case 'leave':
            return 'danger';
        default:
            return 'secondary';
    }
}

function exportToCSV() {
    if (currentData.length === 0) {
        showAlert('No data to export', 'warning');
        return;
    }
    
    const headers = ['Date/Start Date','End Date', 'User', 'Type', 'Start Time', 'End Time', 'Status', 'Notes'];
    const csvContent = [
        headers.join(','),
        ...currentData.map(entry => {
            const date = new Date(entry.date).toISOString().split('T')[0];
            const end_date = new Date(entry.end_date).toLocaleDateString();
        
            return [
                date,
                end_date||'',
                entry.username,
                entry.type,
                entry.start_time || '',
                entry.end_time || '',
                entry.status,
                entry.notes || ''
            ].map(field => `"${field}"`).join(',');
        })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `availability_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert('Analytics data exported successfully!', 'success');
}

function showAlert(message, type) {
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.insertBefore(alert, alertContainer.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}