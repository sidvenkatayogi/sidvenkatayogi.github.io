(function () {
    var button = document.querySelector('.terminal-copy');
    var command = document.getElementById('ssh-command');
    var status = document.getElementById('terminal-copy-status');
    if (!button || !command || !status) return;
    var resetTimer;

    button.addEventListener('click', async function () {
        clearTimeout(resetTimer);
        button.removeAttribute('data-copied');
        button.setAttribute('aria-label', 'Copy SSH command');
        try {
            await navigator.clipboard.writeText(command.textContent.trim());
            button.setAttribute('data-copied', '');
            button.setAttribute('aria-label', 'SSH command copied');
            status.textContent = 'copied';
            resetTimer = setTimeout(function () {
                button.removeAttribute('data-copied');
                button.setAttribute('aria-label', 'Copy SSH command');
                status.textContent = '';
            }, 2000);
        } catch (error) {
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(command);
            selection.removeAllRanges();
            selection.addRange(range);
            status.textContent = 'Select and copy the command above.';
        }
    });
})();
