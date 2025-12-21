(function () {
    function getHtmlTheme() {
        const value = document.documentElement.getAttribute("data-theme");
        if (value === "dark" || value === "light") return value;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function mapToGiscusTheme(theme) {
        return theme === "dark" ? "dark" : "light";
    }

    function setGiscusTheme(theme) {
        const iframe = document.querySelector("iframe.giscus-frame");
        if (!iframe) return;

        iframe.contentWindow.postMessage(
            { giscus: { setConfig: { theme: theme } } },
            "https://giscus.app"
        );
    }

    function sync() {
        setGiscusTheme(mapToGiscusTheme(getHtmlTheme()));
    }

    window.addEventListener("load", () => {
        sync();
        let tries = 0;
        const timer = setInterval(() => {
            sync();
            tries += 1;
            if (document.querySelector("iframe.giscus-frame") || tries >= 10) clearInterval(timer);
        }, 300);
    });

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
                sync();
            }
        }
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });
})();
