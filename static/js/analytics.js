// Analytics Dashboard JavaScript
console.log('Analytics.js file loaded successfully!'); // Basic test
console.log('Window location:', window.location.href); // Debug current page

// Check if Chart.js is available
if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded!');
} else {
    console.log('Chart.js library is available');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting analytics initialization...'); // Basic test
    
    // Check if essential elements exist
    const requiredElements = ['workHoursTrendChart', 'timeRangeFilter'];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Required element '${id}' not found!`);
        } else {
            console.log(`Element '${id}' found successfully`);
        }
    });
    
    // Initialize charts and load data
    try {
        initializeAnalytics();
    } catch (error) {
        console.error('Error initializing analytics:', error);
    }
    
    // Set up filters
    document.getElementById('timeRangeFilter').addEventListener('change', function() {
        loadAnalyticsData();
    });
});

let charts = {
    workHoursTrend: null
};

function initializeAnalytics() {
    console.log('Initializing analytics dashboard...'); // Debug log
    
    // Create chart instances
    createCharts();
    
    // Load initial data
    loadAnalyticsData();
    
    // Refresh data every 5 minutes
    setInterval(loadAnalyticsData, 300000);
}

function createCharts() {
    console.log('Creating charts...'); // Debug log
    
    // Work Hours Trend Chart
    const trendCtx = document.getElementById('workHoursTrendChart');
    if (!trendCtx) {
        console.error('workHoursTrendChart element not found!');
        return;
    }
    const trendContext = trendCtx.getContext('2d');
    charts.workHoursTrend = new Chart(trendContext, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Hours',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

function loadAnalyticsData() {
    console.log('Loading analytics data...'); // Debug log
    showLoading();
    
    // Get selected time range
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const days = timeRangeFilter ? timeRangeFilter.value : '30';
    console.log('Loading analytics for', days, 'days'); // Debug log
    
    // Load analytics data
    Promise.all([
        loadOverviewData(days),
        loadWorkHoursTrend(days)
    ]).then(() => {
        console.log('All analytics data loaded successfully'); // Debug log
        hideLoading();
    }).catch(error => {
        console.error('Analytics loading failed:', error.message || error);
        hideLoading();
        showError('Failed to load analytics data');
    });
}

function loadOverviewData(days) {
    console.log('Loading overview data for', days, 'days...'); // Debug log
    return fetch(`/api/analytics/overview?days=${days}`)
        .then(response => response.json())
        .then(data => {
            console.log('Overview data response:', data); // Debug log
            if (data.success) {
                updateOverviewMetrics(data);
            } else {
                console.error('Overview data API error:', data.error);
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('Overview data fetch failed:', error.message || error);
            throw error;
        });
}

function loadWorkHoursTrend(days) {
    console.log('Loading work hours trend for', days, 'days...'); // Debug log
    return fetch(`/api/analytics/work-hours-trend?days=${days}`)
        .then(response => response.json())
        .then(data => {
            console.log('Work hours trend response:', data); // Debug log
            if (data.success) {
                updateWorkHoursTrendChart(data.data);
            } else {
                console.error('Work hours trend API error:', data.error);
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('Work hours trend fetch failed:', error.message || error);
            throw error;
        });
}

function updateOverviewMetrics(data) {
    const elements = {
        'activeUsersMetric': data.active_users || 0,
        'totalHoursMetric': (data.total_hours || 0) + 'h',
        'weekHoursMetric': (data.week_hours || 0) + 'h'
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

function updateWorkHoursTrendChart(data) {
    const labels = data.map(item => new Date(item.date).toLocaleDateString());
    const hours = data.map(item => item.hours);
    
    charts.workHoursTrend.data.labels = labels;
    charts.workHoursTrend.data.datasets[0].data = hours;
    charts.workHoursTrend.update();
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('d-none');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
}

function showError(message) {
    // Create a simple alert for errors
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

function exportAnalyticsData() {
    console.log('Exporting analytics data...');
    showError('Export functionality coming soon!');
}