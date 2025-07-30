document.addEventListener('DOMContentLoaded', async () => {
    const contentSection = document.querySelector('.content-section');
    const converter = new showdown.Converter({ metadata: true });

    async function fetchMarkdown(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return await response.text();
    }

    function getFileId(filePath) {
        return filePath.split('/').pop().replace('.md', '');
    }

    function getSectionFromPath(path) {
        if (path.includes('programming.html')) return 'programming';
        if (path.includes('art.html')) return 'art';
        if (path.includes('blog.html')) return 'blog';
        if (path.includes('about.html')) return 'about-me';
        return 'about-me'; // Default section
    }

    function getMarkdownFilePaths(sectionId) {
        if (sectionId === 'about-me') {
            return ['_pages/about.md'];
        } else if (sectionId === 'programming') {
            return ['_projects/project_01.md', '_projects/project_02.md', '_projects/project_03.md'];
        } else if (sectionId === 'art') {
            const paths = [];
            for (let i = 1; i <= 10; i++) {
                paths.push(`_art/portfolio-${String(i).padStart(2, '0')}.md`);
            }
            return paths;
        } else if (sectionId === 'blog') {
            return ['_posts/2025-05-29-blog-post.md', '_posts/2025-07-20-blog-post.md'];
        }
        return [];
    }

    function parseMarkdown(md, filePath) {
        const content = md.replace(/---[\s\S]*?---/, '').trim();
        const metadata = md.match(/---([\s\S]*?)---/);
        const frontmatter = {};
        if (metadata) {
            const lines = metadata[1].split('\n');
            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim().replace(/^[\'\"]|[\'\"]$/g, '');
                    frontmatter[key] = value;
                } 
            });
        }
        return { ...frontmatter, content: converter.makeHtml(content), id: getFileId(filePath) };
    }

    function displayListView(items, sectionId) {
        const navLink = document.querySelector(`nav a[href*="${sectionId}"]`);
        const sectionName = navLink ? navLink.textContent : "Content";
        let listHtml = `<h2>${sectionName}</h2>`;

        items.forEach(item => {
            const link = `?id=${item.id}`;
            listHtml += `
                <div class="list-item">
                    <h3><a href="${link}">${item.title || 'Untitled'}</a></h3>
                    <div class="excerpt">${item.excerpt || ''}</div>
                </div>
            `;
        });

        contentSection.innerHTML = listHtml;
    }

    function displayDetailView(item, sectionId) {
        let detailHtml = `
            <h2>${item.title || 'Untitled'}</h2>
            <div class="full-content">${item.content}</div>
        `;
        contentSection.innerHTML = detailHtml;
    }

    async function renderListPage(sectionId) {
        const filePaths = getMarkdownFilePaths(sectionId);
        const markdownPromises = filePaths.map(path => fetchMarkdown(path));
        const markdownContent = await Promise.all(markdownPromises);
        const parsedContent = markdownContent.map((md, index) => parseMarkdown(md, filePaths[index]));

        if (sectionId === 'about-me') {
            displayDetailView(parsedContent[0], sectionId);
        } else {
            displayListView(parsedContent.reverse(), sectionId);
        }
    }

    async function renderDetailPage(sectionId, itemId) {
        let filePath;
        if (sectionId === 'programming') {
            filePath = `_projects/${itemId}.md`;
        } else if (sectionId === 'art') {
            filePath = `_art/${itemId}.md`;
        } else if (sectionId === 'blog') {
            filePath = `_posts/${itemId}.md`;
        } else {
            // Handle 'about-me' or other sections if they have detail views
            filePath = `_pages/about.md`;
        }

        try {
            const markdown = await fetchMarkdown(filePath);
            const item = parseMarkdown(markdown, filePath);
            displayDetailView(item, sectionId);
        } catch (error) {
            console.error(error);
            contentSection.innerHTML = `<p>Sorry, the content could not be loaded. Please check the URL or go back to the list.</p><div class="back-link"><a href="${sectionId}.html">&larr; Back to list</a></div>`;
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');
    const sectionId = getSectionFromPath(window.location.pathname);

    if (itemId) {
        renderDetailPage(sectionId, itemId);
    } else {
        renderListPage(sectionId);
    }
});