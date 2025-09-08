// Example data for the charts (replace with actual data from user input)
const transportationData = {
    labels: ['Car', 'Public Transport', 'Air Travel'],
    datasets: [{
        label: 'Emissions (kg CO2)',
        data: [120, 80, 200],
        backgroundColor: ['#FF5733', '#33FF57', '#3357FF'],
        borderColor: ['#FF5733', '#33FF57', '#3357FF'],
        borderWidth: 1
    }]
};

const energyData = {
    labels: ['Electricity', 'Heating', 'Natural Gas Usage', 'Heating Oil Usage', 'Coal Usage', 'LPG Usage', 'Propane Usage', 'Wooden Pellets Usage'],
    datasets: [{
        label: 'Emissions (kg CO2)',
        data: [250, 100, 60, 30, 47, 94, 20, 9],
        backgroundColor: ['#FF8C00', '#32CD32', '#1E90FF', '#66ff99', '#e6e600', '#e600e6', '#ff0000', '#9900ff'],
        borderColor: ['#FF8C00', '#32CD32', '#1E90FF', '#66ff99', '#e6e600', '#e600e6', '#ff0000', '#9900ff'],
        borderWidth: 1
    }]
};

// const foodData = {
//     labels: ['Meat', 'Dairy', 'Plant-based'],
//     datasets: [{
//         label: 'Emissions (kg CO2)',
//         data: [350, 100, 50],
//         backgroundColor: ['#FF6347', '#FFD700', '#98FB98'],
//         borderColor: ['#FF6347', '#FFD700', '#98FB98'],
//         borderWidth: 1
//     }]
// };

// Initialize charts
const transportationChart = new Chart(document.getElementById('transportationChart'), {
    type: 'pie',
    data: transportationData
});

const energyChart = new Chart(document.getElementById('energyChart'), {
    type: 'pie',
    data: energyData
});

// const foodChart = new Chart(document.getElementById('foodChart'), {
//     type: 'pie',
//     data: foodData
// });
