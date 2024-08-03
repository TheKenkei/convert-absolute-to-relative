#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { JSDOM } from "jsdom";

async function processHtmlFile(filePath, baseHref) {
  const content = await fs.readFile(filePath, "utf-8");
  const dom = new JSDOM(content);
  const document = dom.window.document;

  let updated = false;

  function makeRelative(url) {
    if (url.startsWith("/")) {
      updated = true;
      return url.slice(1); // удаляем начальный '/'
    }
    return url;
  }

  // Добавляем <base href> в <head>
  const head = document.querySelector("head");
  if (head && !document.querySelector("base")) {
    const baseElement = document.createElement("base");
    baseElement.setAttribute("href", baseHref);
    head.prepend(baseElement);
    updated = true;
  }

  // Обработка <link> тегов
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      link.setAttribute("href", makeRelative(href));
    }
  });

  // Обработка <script> тегов
  const scripts = document.querySelectorAll("script[src]");
  scripts.forEach((script) => {
    const src = script.getAttribute("src");
    if (src) {
      script.setAttribute("src", makeRelative(src));
    }
  });

  // Обработка <img> тегов
  const images = document.querySelectorAll("img[src]");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      img.setAttribute("src", makeRelative(src));
    }
  });

  // Обработка <a> тегов
  const anchors = document.querySelectorAll("a[href]");
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href) {
      anchor.setAttribute("href", makeRelative(href));
    }
  });

  // Обработка содержимого JavaScript в HTML-файлах
  const scriptsInHtml = document.querySelectorAll("script");
  scriptsInHtml.forEach((script) => {
    if (script.textContent) {
      const updatedContent = script.textContent.replace(
        /e\.Z=\{src:"\/_next\//g,
        `e.Z={src:"${baseHref}_next/`
      );
      if (updatedContent !== script.textContent) {
        updated = true;
        script.textContent = updatedContent;
      }
    }
  });

  if (updated) {
    const newContent = dom.serialize();
    await fs.writeFile(filePath, newContent, "utf-8");
    console.log(`Updated file: ${filePath}`);
  }
}

async function processJsFile(filePath, baseHref) {
  let content = await fs.readFile(filePath, "utf-8");
  const pattern = /e\.Z=\{src:"\/_next\//g;
  const replacement = `e.Z={src:"${baseHref}_next/`;

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    await fs.writeFile(filePath, content, "utf-8");
    console.log(`Updated file: ${filePath}`);
  }
}

async function processDirectory(directory, baseHref) {
  const items = await fs.readdir(directory, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(directory, item.name);

    if (item.isDirectory()) {
      await processDirectory(fullPath, baseHref);
    } else if (item.isFile() && fullPath.endsWith(".html")) {
      await processHtmlFile(fullPath, baseHref);
    } else if (item.isFile() && fullPath.endsWith(".js")) {
      await processJsFile(fullPath, baseHref);
    }
  }
}

async function main() {
  const [, , rootDir] = process.argv;

  if (!rootDir) {
    console.error("Usage: node convertAbsolutePathsToRelative.js <directory>");
    process.exit(1);
  }

  // Определяем base href на основе имени последней папки
  const baseHref = `/${path.basename(rootDir)}/`;

  await processDirectory(rootDir, baseHref);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
