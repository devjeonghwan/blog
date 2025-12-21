(function () {
    "use strict";

    function safeDecodeURIComponentOrReturnOriginal(inputString) {
        if (typeof inputString !== "string") {
            return inputString;
        }

        try {
            return decodeURIComponent(inputString);
        } catch (decodeError) {
            return inputString;
        }
    }

    function parseQueryStringFromImageSource(imageSourceUrlString) {
        if (typeof imageSourceUrlString !== "string") {
            return undefined;
        }

        var splitByQuestionMarkArray = imageSourceUrlString.split("?");
        if (splitByQuestionMarkArray.length < 2) {
            return undefined;
        }

        var queryStringOnly = splitByQuestionMarkArray.slice(1).join("?");

        if (queryStringOnly.length === 0) {
            return undefined;
        }

        var normalizedQueryString = queryStringOnly.replace(/&amp;/g, "&");

        var querySegmentsArray = normalizedQueryString.split("&");
        var parsedParameterObject = {};

        for (var segmentIndex = 0; segmentIndex < querySegmentsArray.length; segmentIndex++) {
            var keyValuePairString = querySegmentsArray[segmentIndex];
            if (!keyValuePairString) {
                continue;
            }

            var splitByEqualsArray = keyValuePairString.split("=");
            var parameterKeyRaw = splitByEqualsArray[0];
            var parameterValueRaw = splitByEqualsArray.length >= 2 ? splitByEqualsArray.slice(1).join("=") : "";

            if (!parameterKeyRaw) {
                continue;
            }

            parameterKeyRaw = parameterKeyRaw.replace(/\+/g, " ");
            parameterValueRaw = parameterValueRaw.replace(/\+/g, " ");

            var decodedParameterKey = safeDecodeURIComponentOrReturnOriginal(parameterKeyRaw);
            var decodedParameterValue = safeDecodeURIComponentOrReturnOriginal(parameterValueRaw);

            parsedParameterObject[decodedParameterKey] = decodedParameterValue;
        }

        return parsedParameterObject;
    }

    function addCssClassesFromCommaSeparatedList(htmlImageElement, commaSeparatedClassListString) {
        if (!htmlImageElement || typeof commaSeparatedClassListString !== "string") {
            return;
        }

        var classNameArray = commaSeparatedClassListString.split(",");
        for (var classIndex = 0; classIndex < classNameArray.length; classIndex++) {
            var candidateClassName = classNameArray[classIndex].trim();
            if (candidateClassName.length === 0) {
                continue;
            }
            htmlImageElement.classList.add(candidateClassName);
        }
    }

    function applyInlineSizeStylesFromParameters(htmlImageElement, parsedParameterObject) {
        if (!htmlImageElement || !parsedParameterObject) {
            return;
        }

        var minWidthParameterValue = parsedParameterObject["min-width"];
        var maxWidthParameterValue = parsedParameterObject["max-width"];
        var widthParameterValue = parsedParameterObject["width"];

        var minHeightParameterValue = parsedParameterObject["min-height"];
        var maxHeightParameterValue = parsedParameterObject["max-height"];
        var heightParameterValue = parsedParameterObject["height"];

        if (typeof minWidthParameterValue === "string" && minWidthParameterValue.length > 0) {
            htmlImageElement.style.minWidth = minWidthParameterValue;
        }
        if (typeof maxWidthParameterValue === "string" && maxWidthParameterValue.length > 0) {
            htmlImageElement.style.maxWidth = maxWidthParameterValue;
        }
        if (typeof widthParameterValue === "string" && widthParameterValue.length > 0) {
            htmlImageElement.style.width = widthParameterValue;
        }

        if (typeof minHeightParameterValue === "string" && minHeightParameterValue.length > 0) {
            htmlImageElement.style.minHeight = minHeightParameterValue;
        }
        if (typeof maxHeightParameterValue === "string" && maxHeightParameterValue.length > 0) {
            htmlImageElement.style.maxHeight = maxHeightParameterValue;
        }
        if (typeof heightParameterValue === "string" && heightParameterValue.length > 0) {
            htmlImageElement.style.height = heightParameterValue;
        }
    }

    function applyLoadingAttributeFromParameters(htmlImageElement, parsedParameterObject) {
        if (!htmlImageElement || !parsedParameterObject) {
            return;
        }

        var loadingParameterValue = parsedParameterObject["loading"];
        if (typeof loadingParameterValue === "string" && loadingParameterValue.length > 0) {
            htmlImageElement.setAttribute("loading", loadingParameterValue);
        }
    }

    function optionallyRemoveQueryStringFromImageSource(htmlImageElement, shouldRemoveQueryString) {
        if (!shouldRemoveQueryString) {
            return;
        }

        var originalImageSourceUrlString = htmlImageElement.getAttribute("src");
        if (typeof originalImageSourceUrlString !== "string") {
            return;
        }

        var splitByQuestionMarkArray = originalImageSourceUrlString.split("?");
        if (splitByQuestionMarkArray.length < 2) {
            return;
        }

        var imageSourceWithoutQueryString = splitByQuestionMarkArray[0];
        htmlImageElement.setAttribute("src", imageSourceWithoutQueryString);
    }

    function applyMarkdownImageParametersToAllImages() {
        var htmlImageNodeList = document.querySelectorAll(".post-content img:not(.inline), .content img:not(.inline)");

        for (var imageIndex = 0; imageIndex < htmlImageNodeList.length; imageIndex++) {
            var htmlImageElement = htmlImageNodeList[imageIndex];

            var imageSourceUrlString = htmlImageElement.getAttribute("src");
            var parsedParameterObject = parseQueryStringFromImageSource(imageSourceUrlString);

            if (!parsedParameterObject) {
                continue;
            }

            applyInlineSizeStylesFromParameters(htmlImageElement, parsedParameterObject);

            var classesParameterValue = parsedParameterObject["classes"];
            if (typeof classesParameterValue === "string" && classesParameterValue.length > 0) {
                addCssClassesFromCommaSeparatedList(htmlImageElement, classesParameterValue);
            }

            applyLoadingAttributeFromParameters(htmlImageElement, parsedParameterObject);

            optionallyRemoveQueryStringFromImageSource(htmlImageElement, false);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyMarkdownImageParametersToAllImages);
    } else {
        applyMarkdownImageParametersToAllImages();
    }
})();
