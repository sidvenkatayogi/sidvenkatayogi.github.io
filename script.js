document.addEventListener('DOMContentLoaded', async () => {
    const navLinks = document.querySelectorAll('nav a');
    const contentSections = document.querySelectorAll('.content-section');
    const converter = new showdown.Converter({ metadata: true });

    const rawContent = {
        'about-me': [`---
title: "About Me"
---
Welcome! I'm an incoming freshman and computer science student at UT Austin. I'm interested in exploring many computer science/programming topics, but some that I'm currently interested in are Computer Vision, Natural Language Processing, and Graphics. I'm especially interested in using these topics in software for real users. I'm still trying to decide between pursuing industry, a PhD, or a startup.\n\nIn my free time, I like to study various math topics, [draw](/art), write comics, watch shows/movies (currently watching One Piece), play basketball/ volleyball/ soccer (non-competitively), or go to the gym.\n\n## Contact\nFeel free to contact me; I'm always looking for new opportunities! The best way to contact me right now is through my **email**. Linkedin also works but I don't check it as often. Honestly, I don't use Twitter or Bluesky, but I plan to start posting my new projects and blog posts on there to get more reach.`]
        ,
        'programming': [
`---
title: AP Research Method
excerpt: "<img src='/images/ap_thumbnail.png' width='500' height='auto'>"
---
### My (HS) Junior Year AP Capstone project. "An Exploratory Analysis of Audience Size Trends of Human and AI Art on Instagram". Got a 5 on it. I also made a Python module to scrape instagram reels data (no idea if it still works). [Link to full paper]((https://sidvenkatayogi.github.io/files/AnExploratoryAnalysisofAudienceSizeTrendsofHumanandAIArtonInstagram.pdf)) (not published). Code on [Github](https://github.com/sidvenkatayogi/APResearch_Instagram)`,
`---
title: Word Wizard
excerpt: "<img src='/images/ww_thumbnail.png' width='500' height='auto'>"
---
### Word Wizard is a linear story-based 2D pixel game where you use words to get through the levels. This puzzle and adventure game requires you to play unique word puzzles and get past the action. The full game info, web player, and downloads can be found on [itch.io](https://sidvenkatayogi.itch.io/word-wizard) and [Newgrounds](https://www.newgrounds.com/portal/view/899710). Code on [Github](https://github.com/sidvenkatayogi/Word-Wizard-NLC)\n\n## Demo\n<iframe width="560" height="315" src="https://www.youtube.com/embed/bWH3mcLmwJU?si=r3d3pXjIF69P0Ru6" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
`---
title: PIXIE: PIcture eXploration and Inference Engine
excerpt: "<img src='/images/pixie_social_preview.png' width='500' height='auto'>"
---
### Pixie lets you view and explore your saved images by various indices. It's perfect for visual creatives looking for a novel, intuitive visual method to browse/search for inspiration and reference. Visit [my blog post](https://sidvenkatayogi.github.io/posts/2025/07/20/) about PIXIE. To get the latest release and more information, visit the [Github repository!](https://github.com/sidvenkatayogi/pixie)\n\n## Demo\n<iframe width="560" height="315" src="https://www.youtube.com/embed/1uvD84H6gYE?si=GGdSo5sIZsoIyJXm" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
        ],
        'art': [
`---
title: EXTERMINATION
excerpt: "<img src='/images/3-11-2024_dragon.png' width='700' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/-NQ8qAIRhI0?si=u28ibKo2zIu29iHD" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/3-11-2024_dragon.png'>`,
`---
title: CORNERSTORE CHAOS
excerpt: "<img src='/images/7-12-2022_street_explosion_scene_wip.png' width='600' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/ZTwlYoKX6ZY?si=PLvyq61QqRuy4Ho6" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/7-12-2022_street_explosion_scene_wip.png'>`,
`---
title: SURVIVAL
excerpt: "<img src='/images/tigers.png' width='700' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/ChtxNEybITM?si=G1J7rFfJarwNunpi" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/tigers.png'>`,
`---
title: WARM FOSSIL
excerpt: "<img src='/images/trex.png' width='600' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/dR1xesddkwo?si=zITF-m-TqcjxBEYC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/trex.png'>`,
`---
title: REFLECTION
excerpt: "<img src='/images/reflection_update.png' width='580' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/TAfD9mtaWcg?si=Yjw2utMUt9i1CEsN" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/reflection_update.png'>`,
`---
title: HEADACHE
excerpt: "<img src='/images/headache_update.png' width='550' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/xpqY1DgAmT8?si=eBmMQ7w_hd1pEzA9" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/headache_update.png'>`,
`---
title: FAIRY
excerpt: "<img src='/images/11-22-22_8485_updated.png' width='450' height='auto'>"
---
## [Timelapse](https://youtube.com/shorts/thr4IBsSrx0?feature=share) (can't embed this bc YouTube made it into a short :/)\n\n<img src='/images/11-22-22_8485_updated.png'>`,
`---
title: LOOK BACK
excerpt: "<img src='/images/retrospect.png' width='800' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/Dm7lTidREU8?si=SF72DiOrdrT9LHCc" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/retrospect.png'>`,
`---
title: COUCH
excerpt: "<img src='/images/couch.png' width='500' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/5aMY8M7cHtQ?si=qbeCWDrn8XOnbS83" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/couch.png'>`,
`---
title: DEEP WATER
excerpt: "<img src='/images/sub.png' width='700' height='auto'>"
---
<iframe width="560" height="315" src="https://www.youtube.com/embed/QTdj6nn40V0?si=LoijRuowtZiUlT-3" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n\n<img src='/images/sub.png'>`
        ],
        'blog': [
`---
title: New Website!
date: 2025-05-29
---
I just started my first personal website! I'm still working on different parts of the website but I finished adding my info, socials, and art. I think that's a good start for the first day. S/o to the academic pages template!!! Normally I wouldn't do this, but I just copied the template and vibe coded the rest. I know minimal HTML/CSS, and I don't want to spend toooo much time learning it or making this website. This site is mostly just to showcase the projects in the future. I don't have many impressive coding projects to put in the programming section right now, so I have to get to work this summer.`,
`---
title: Making PIXIE: PIcture eXploration and Inference Engine
date: 2025-07-20
---
### I just released PIXIE, a novel tool for visual creatives to intuitively browse/search for inspiration and reference amongst saved images. Below is a overview of my process, thoughts, and experience with the project.\n<p style="text-align: center;"><img src="https://sidvenkatayogi.github.io/images/pixie_logo.png" alt="Pixie Logo" width="200"/></p>\n### Here are the various links for the project:\n  - [Download latest release](https://github.com/sidvenkatayogi/pixie/releases/tag/v1.0.0)\n  - [Github](https://github.com/sidvenkatayogi/pixie)\n  - [Demo](https://youtu.be/1uvD84H6gYE?si=GXC_DuWDxn5b5y3y)\n\n<br/><br/>\n\n# Making PIXIE\n## Table of Contents\n* [Intro](#intro)\n* [Using PyQt](#using-pyqt)\n* [Similarity Search](#similarity-search)\n  * [Searching by Color](#searching-by-color)\n  * [ChromaDB -> FAISS](#chromadb---faiss)\n* [Creating Mosaics](#creating-mosaics)\n  * [Hexagon Layout](#hexagon-layout)\n  * [Circular Layouts](#circular-layouts)\n* [Issues](#issues)\n  * [Bugs](#bugs)\n  * [Bottlenecks](#bottlenecks)\n* [Everything else](#everything-else)\n\n## Intro\nPixie started as a short project that used a vector database to search for images using CLIP. As I was building, I wanted to add even more search types and I had a cool idea for the UI, which lead to the final version. This post is going to cover what tools I used and what steps I took to complete this.\n## Using PyQt\nThe entire application is made with Python with the UI made with PyQt. I used PyQt5 over PyQt6 because it’s my first time using Qt. The Qt docs are only in C++, which isn’t a huge deal, but there were so many tutorials for 5 over 6, so using PyQt5 was a lot easier to get started with. I’d say like a third of the UI code was LLM generated, just because it was really good at generating examples for me and getting things up and running. This was mostly just copy pasting code into GPT, Gemini, or Claude, but I also tried out GitHub Copilot which is integrated into VSCode. I’m trying not to use AI so I can learn, so I tried to use LLMs only on trivial stuff I would’ve had to spend time just looking at the docs for. I was really tempted to try out the free Gemini CLI though.\n## Similarity Search\nAs the intro said, at I first was just trying to make a simple image search. Vector databases are probably the most standard way to do this so I started with ChromaDB (I this changed later), because it was popular and had a built in CLIP embedding function. When that was done, I had the idea of searching for images by color.\n### Searching by Color\nThis was a pretty unique problem. I first started researching how to do this. The best method I found was a [shutterstock demo](https://youtu.be/WjnLhtwp678?si=0-bV5q52eiXjLoss&t=658). In that program, they converted an image into a histogram of color. This was a really good solution of course, which you can see in action in that demo. I could've used that approach but I wanted to do something unique this project, so I came up with my own method. Also, I don't think they had a search by colors from an image option (I could still try using a histogram for that but nah).\nComing from using vector embeddings for text and images in CLIP, I stayed consistent and tried a vector approach. This includes 2 parts. Embedding an image into a color vector, and then computing the distance/similarity of those vectors. The simplest way would be to get the average color of all the pixels and then use euclidean distance with the RGB values. But this would probably give me a gray or brown mush of all the pixels. Then I figured to reduce the number of colors of in the image. After that I could just get the most frequent color and use RGB euclidean distance. This would work on a basic level, but it wouldn't capture the other colors in the image. To do that, we could just get the k most frequent/dominant colors in that reduced palette. If the reduced color that was picked is not actually that dominant (like less than 5% of the most dominant color) it shouldn't be considered dominant. I also checked if a possible dominant color was significantly different than any other color of the more previous dominant colors. While we can have k dominant colors, it's possible some images will have less than that, so the resulting color vectors won't always have the same dimensions. Now we have a vector that contains the RGB values for the k dominant colors in our image. This is great because this also doubles as a method to get a color palette for the image.\n\nNow we have a different problem. With multiple colors, we can't just simply get the euclidean distance of every value in our vector like we could with 2 RGB vectors. To solve this, I created a custom distance function that calculates and sums the distance of each color to every other color. I then weighted these distances with how dominant they were, so a large difference/distance between 2 dominant colors would result in a large total image-level color distance. At first I tried using rank weighting, but I ended up using the actual frequencies of the color on the reduced image, which is much more intuitive, also considering these were already picked as the dominant colors.\nFor the individual color distances, I don't use simple RGB euclidean distance. I convert each RGB into the CIE-LAB color space and then get euclidean distance because it's supposed to be more close to actual perceptual differences in color, but honestly I don't really see much difference in the results. What did have a significant difference though is adding a penalty for hue differences. I also weighed this hue difference by the saturation and its value. My logic behind this is that the more saturated a color is, the more the hue matters. The hue also matters the most at medium lightness/value. At first I just weighted the penalty with a peak at 0.5 lightness, but I was having an issue with white dominant images being scattered within results making me think they were close/had low distance to a lot of images. I think this arises with using CIE-LAB. Then I decided to weigh the penalty higher for colors that have low-medium lightness and that improved the results. Even though it should reduce the penalty for white colors supposedly giving them an even closer distance, it made them appear less in the results. I'm not really sure how this worked. \nMy final code isn't exactly elegant, but it gives very visually appealing results on most images and searches. I looked into other possible options, like Hungarian matching, but honestly they seemed to do worse. Plus, my method is a lot easier to tweak because of how simple it is. A lot of this algorithm was just testing different ideas and parameters a bunch of queries and deciding if I liked it or not. Right now, I think the single solid color query works great, which I consider the baseline (from that shutterstock demo and other programs). The color search by image also works well, but I'm still not 100% satisfied with it. That's probably at the top of the list of things that I want to improve in the future.\n\nI also looked into something called color hashing, a form of image hashing, but I didn't interpret the different clusters it made that well. I also didn't spend much time with this. I did add a class to store color hashes though (similar to the vector store). This is another thing I might try to use in the future. \n\nThis custom distance function was really annoying, partly because of the problems above, but also because  I couldn't find an off the shelf vector database/store that let you define your own distance function. Not sure if you can enter different sized vectors (for varying number of colors) either, but I still could've just padded the color vectors. The custom distance was a problem. Maybe this was a sign that the color vector approach was dumb, but I just decided to create my own vector store from scratch lol. Here I just implemented KNN. I looked into HNSW, which is a popular algorithm for Approximate Nearest Neighbors (greedy version of KNN that's much faster), but I figured that KNN was good enough for me knowing that nobody was going to have more than like 10,000 images in a single collection, especially not millions. If I wanted to scale up this project to have a shared images across users like Pinterest, I would use HNSW (but also look into other vector database/store options).\n### ChromaDB -> FAISS\nWhile I started using ChromaDB, it worked pretty well. But when I started integrating the database access with the actual application and UI, for some reason the database wasn't working. It seemed like the problem happened when I tried accessing the persisted/saved DB from a separate python file than the one I created it in which didn't make sense at all. All my code looked correct (most of it was basic code I copied from the ChromaDB examples), so I was tweaking out when this happened and I just scrapped using ChromaDB. My usage wasn't even complex so I really was annoyed. Then I started using FAISS because I had experimented with it before and I haven't had any problems since.\n## Creating Mosaics\nSo I knew I wanted a view that had a central image for color and visual search, and for CLIP I just let it be blank in the middle. I had the idea to place images radiating outwards on a 2D plane, and I stuck with that.\n### Hexagon Layout\nI first started with the hexagon layout, because I thought it would look cool (it does) but I probably should've started with the circle one because it was the simplest. I started placing the center image. and then creating hexagonal rings around that. Placing the images in hexagonal rings was **NOT** trivial. I ended up binning each image into a side of a hexagonal ring. Then I randomly chose from each side, and only when I had sampled from each side once, I could go back and sample an image from a side. This created a even structured and random method of populating the hexagon layout. [This page](https://www.redblobgames.com/grids/hexagons/#rings) by Red Blob Games was really useful in creating this.\n### Circular Layouts\nNext up was the circle layouts. The default circular layout was pretty easy to make. I used a polar approach. First I decided how many images would be in each ring, then I split up the angular space by the number of images planned to be in the ring. Then I placed the images at that angle and increased the radius each time I stepped up to a new ring. I added stuff like a offset and a randomness to the number of images in each ring so that there wasn't a line of images radiating from where there was guranteed an image to be at θ = zero or unnatural patterns in the layout. The final result is pretty cool. Next was the circles by hue layout. This was also pretty easy using the original circle layout logic, just replacing the angle θ of the image with it's average hue (extracted using a circular mean on the hues of the dominant colors). At first I just sorted the images by hue (within each ring) and tried using the original circle layout logic, but it produce any visually appealing results like what I have now. I do have the problem of images being covered up by others, which I might look into in the future, but I left it as is because spreading images out may produce a less appealing affect. Plus, the varying density of the hue area looks cool and hints to how many images there are, and a user can actually fully explore it by searching by a color (that represents that hue area) in that collection (with a circle or hexagon layout).\n## Issues\n### Bugs\nThere's a bug with the panning of the view. There's a bias to the left side of the view, and only occurs when I drag a considerable distance (not short mouse movements). Also, sometimes when I stop panning, the program starts linearly panning (usually left or diagonally left and up) when I let go, then stops after a second. I tried a lot to fix this but I couldn't figure it out. These panning issues don't affect the core program, but does affect UX. I also didn't fully stress test this app completely. There's probably some invalid input or UI error somewhere but should be fine if you just restart the app.\n### Bottlenecks\nThe main processes in this program is creating indices, downloading pinterest boards, and rendering images. All of the search types seem to be working as best as they can. It does take a little bit of time to add CLIP and DINO indices for me, but also I don't have a GPU. My method of using it I think is pretty standard, so I'm not really focused on improving that, especially because it's just a one/few time wait for each collection. Downloading the Pinterest board is straightforward and PinterestDL is mainly doing everything so not much room ofr improvement there. It would be nice to have real progress percentage in the progress bar for downloading, but PinterestDL doesn't have an easy option to do that.\nThe main issue I'm not satisified with is rendering the images. what's happening is that the QImages, which I need to place on the QGraphicsView, are taking a significant amount of time to create. I'm not an expert in Qt, but I did try researching a lot but couldn't find a better option. It would be really nice to have short wait times for each query, but idk. I tried caching the QImages, which had really good speed, but I ran out of RAM really quick on my 8GB laptop. I just decided to leave it alone for release.\n\n## Everything else\nMost of the other code was UI stuff and performance stuff like using threads with QThreads. I'm skipping over explaining it because it's not super interesting, but this was probably the bulk of where the time in this project went. The stuff above (besides tweaks to the color distance which I was making throughout the project timeline) only took like 1-2 weeks, but the stuff I just mentioned plus learning Qt, testing, bug fixes, saving collections, and everything to make the program actually usable pushed it to 4-5 weeks and taught me a lot about project timelines. If you've read this far, thank you for reading and feel free to contact me!, thank you for reading and feel free to contact me!`
        ]
    };

    const parsedContent = {};

    // Parse all content on load
    for (const section in rawContent) {
        parsedContent[section] = rawContent[section].map(md => {
            const content = md.replace(/---[\s\S]*?---/, '').trim();
            const metadata = md.match(/---([\s\S]*?)---/);
            const frontmatter = {};
            if (metadata) {
                const lines = metadata[1].split('\n');
                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const value = parts.slice(1).join(':').trim().replace(/^['\"]|['\"]$/g, '');
                        frontmatter[key] = value;
                    }
                });
            }
            return { ...frontmatter, content: converter.makeHtml(content) };
        });
    }

    function displayListView(sectionId) {
        const sectionData = parsedContent[sectionId];
        const targetSection = document.getElementById(sectionId);
        const navLink = document.querySelector(`nav a[data-content="${sectionId}"]`);
        let listHtml = `<h2>${navLink.textContent}</h2>`;

        sectionData.forEach((item, index) => {
            listHtml += `
                <div class="list-item">
                    <h3><a href="#" class="detail-link" data-section="${sectionId}" data-index="${index}">${item.title || 'Untitled'}</a></h3>
                    <div class="excerpt">${item.excerpt || ''}</div>
                </div>
            `;
        });

        targetSection.innerHTML = listHtml;
        targetSection.querySelectorAll('.detail-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                const index = e.target.dataset.index;
                displayDetailView(section, index);
            });
        });
    }

    function displayDetailView(sectionId, index) {
        const item = parsedContent[sectionId][index];
        const targetSection = document.getElementById(sectionId);

        let detailHtml = `
            <h2>${item.title || 'Untitled'}</h2>
            <div class="full-content">${item.content}</div>
        `;

        targetSection.innerHTML = detailHtml;
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.content;

            contentSections.forEach(section => {
                section.style.display = 'none';
            });

            const targetSection = document.getElementById(targetId);
            targetSection.style.display = 'block';

            if (targetId === 'about-me') {
                displayDetailView(targetId, 0);
            } else {
                displayListView(targetId);
            }
        });
    });

    // Load personal info by default
    // document.querySelector('nav a[data-content="about-me"]').click();
});