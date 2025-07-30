// Theme Toggle (Radio Buttons)
document.addEventListener('DOMContentLoaded', function() {
    const lightModeRadio = document.getElementById('light-mode');
    const darkModeRadio = document.getElementById('dark-mode');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            darkModeRadio.checked = true;
        } else {
            lightModeRadio.checked = true;
        }
    } else {
        // Default to light mode if no preference is set
        document.body.classList.add('light-mode');
        lightModeRadio.checked = true;
        localStorage.setItem('theme', 'light-mode');
    }

    lightModeRadio.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    });

    darkModeRadio.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        }
    });
});