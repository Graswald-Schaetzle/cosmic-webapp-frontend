document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        editable: true,
        selectable: true,
        events: [
            { title: 'Event 1', start: '2025-04-05' },
            { title: 'Event 2', start: '2025-04-10' }
        ],
        dateClick: function(info) {
            let eventName = prompt("Please enter the event name:");
            if (eventName) {
                calendar.addEvent({
                    title: eventName,
                    start: info.dateStr,
                    allDay: true
                });
            }
        },
        // eventDrop: function(info) { // Оновлення дати після перетягування
        //     alert(`Event "${info.event.title}" was moved to the ${info.event.start.toISOString().split('T')[0]}`);
        // },
        eventClick: function(info) { // Видалення події
            if (confirm(`Remove Event "${info.event.title}"?`)) {
                info.event.remove();
            }
        }
    });
    calendar.render();


    document.querySelector('.calendar-icon').addEventListener('click', function() {
        document.querySelector('#calendar-container').classList.toggle('show');
        calendar.render();
    })
});
