"use strict";

window.$ = window.jQuery = require("jquery");

const remote = require("electron").remote;
const ipc = require("electron").ipcRenderer;
const shared = remote.getGlobal("sharedData");

// const language = require("../../app/language");
// const settings = require("../../app/settings");

const Request = shared.Request; // request-promise(пока только в tf2r) - думаю отказаться в пользу request
const autoUpdater = shared.autoUpdater;

let language = shared.language;
let settings = shared.settings;
let GSuser = remote.getGlobal("user");

let Browser = shared.Browser;
let authWindow = shared.authWindow;
let mainWindow = shared.mainWindow;

let intervalTicks = 0;
let updateIcon = $("div.update-available");
let updateAvail = false;

$(function() {
  autoUpdater.on("update-available", () => {
    updateAvail = true;
    updateIcon.addClass("progress");
  });

  autoUpdater.on("download-progress", (progress, speed, percent) => {
    updateIcon.attr(
      "title",
      language.get("ui.upd_progress") + " - " + percent + "%"
    );
  });

  autoUpdater.on("update-downloaded", () => {
    updateIcon
      .addClass("downloaded")
      .attr("title", language.get("ui.upd_downloaded"));
  });

  // Основной воркер главного окна
  setInterval(intervalSchedules, 1000);

  // UI LOAD
  reloadLangStrings();
  profileSection();

  // Восстановление сохранённых настроек
  let setters = $(".settings .setter").each(function() {
    let item = $(this);

    switch (item.attr("type")) {
      case "checkbox":
        item.prop("checked", settings.get(item.attr("id")));
        break;
    }
  });

  // Переключение типа отображения иконок сервисов
  let menu_switcher = $(".list_type");
  if (settings.get("menu_as_list")) menu_switcher.addClass("state");

  // Смена окон по окончании рендеринга
  authWindow.hide();
  mainWindow.show();

  if (settings.get("start_minimized")) mainWindow.hide();
  else mainWindow.focus();

  // EVENTS

  let icons = $(".services-icons");
  let maxTop = parseInt(icons.css("top").replace("px", ""));

  $(".services_switcher").bind("mousewheel", function(e) {
    let scroll = e.originalEvent.wheelDelta / 120 > 0 ? 20 : -20;

    let height = icons.height();
    let minTop = $(this).height() - height;
    let top = parseInt(icons.css("top").replace("px", ""));
    let newTop = top + scroll;

    if ((scroll > 0 && newTop <= maxTop) || (scroll < 0 && newTop >= minTop))
      top = newTop;

    icons.css("top", top + "px");
  });

  menu_switcher.click(function() {
    $(this).toggleClass("state");

    icons.css("top", maxTop + "px");

    settings.set("menu_as_list", $(this).hasClass("state"));
  });

  // Переключение основных пунктов меню
  $(".menu li span").click(function() {
    let parent = $(this).parent();
    $(".menu li, .content-item").removeClass("active");

    parent
      .add('.content-item[data-id="' + parent.attr("data-id") + '"]')
      .addClass("active");
  });

  // Переключение вкладок внутри сервиса - переключаем сразу во всех сервисах
  $(document).on("click", ".service-panel > ul li", function() {
    $(".service-panel > ul li, .in-service-panel").removeClass("active");
    $('.in-service-panel[data-id="' + $(this).attr("data-id") + '"]')
      .add('.service-panel > ul li[data-id="' + $(this).attr("data-id") + '"]')
      .addClass("active");
  });

  // Клик по кнопке выхода из авторизованного аккаунта
  $(".seeker-button.logout").click(function() {
    let clicked = $(this).addClass("disabled");

    $.ajax({
      method: "get",
      url: "https://giftseeker.ru/logout",
      success: function() {
        mainWindow.hide();
        mainWindow.loadURL(__dirname + "/blank.html");

        ipc.send("save-user", null);
        authWindow.show();
      },
      error: function() {
        clicked.removeClass("disabled");
        alert("something went wrong...");
      }
    });
  });

  // Изменение настроек
  setters.change(function() {
    let changed = $(this);
    let value = changed.val();

    switch (changed.attr("type")) {
      case "checkbox":
        value = changed.prop("checked");
        break;
    }

    if (changed.attr("id") === "lang") {
      ipc.send("change-lang", value);
      return;
    }

    settings.set(changed.attr("id"), value);
  });

  ipc.on("change-lang", function() {
    reloadLangStrings();
  });

  $(document).on("click", ".open-website[data-link]", function() {
    openWebsite($(this).attr("data-link"));
  });
});

function intervalSchedules() {
  // Проверяем обновления
  if (intervalTicks % 300 === 0 && !shared.isPortable && !updateAvail)
    autoUpdater.checkForUpdatesAndNotify();

  // TrayIcon.removeAllListeners('balloon-click');

  // Обновляем инфо о юзере
  if (intervalTicks !== 0 && intervalTicks % 300 === 0) {
    $.ajax({
      url: "https://giftseeker.ru/api/userData",
      data: { ver: currentBuild },
      dataType: "json",
      success: function(data) {
        if (data.response) renderUser(data.response);
      }
    });
  }

  intervalTicks++;
}

function reloadLangStrings() {
  $("[data-lang]").each(function() {
    $(this).html(language.get($(this).attr("data-lang")));
  });

  $("[data-lang-title]").each(function() {
    $(this).attr("title", language.get($(this).attr("data-lang-title")));
  });
}

function profileSection() {
  renderUser(GSuser);

  $(".build .version").text(currentBuild);

  const languageSwitch = $("select#lang");
  const languagesList = language.listAvailable();

  // Наполняем языковой селект, либо удаляем его
  if (language.count() <= 1) languageSwitch.remove();
  else {
    for (let lang in languagesList) {
      let option = $(document.createElement("option"))
        .attr("id", languagesList[lang].lang_culture)
        .val(lang)
        .text(
          "[" +
            languagesList[lang].lang_culture +
            "] " +
            languagesList[lang].lang_name
        );

      if (language.current() === lang) option.prop("selected", true);

      languageSwitch.append(option);
    }
  }

  // Ссылки внизу
  let info_links = $(".content-item .info-links");

  $(document.createElement("button"))
    .addClass("open-website")
    .text("GiftSeeker.RU")
    .attr("data-link", "https://giftseeker.ru/")
    .appendTo(info_links);

  $(document.createElement("button"))
    .addClass("open-website")
    .attr("data-lang", "profile.steam_group")
    .text(language.get("profile.steam_group"))
    .css("margin-left", "7px")
    .attr("data-link", "https://steamcommunity.com/groups/GiftSeeker")
    .appendTo(info_links);

  $(document.createElement("button"))
    .addClass("open-website")
    .attr("data-lang", "profile.donation")
    .text(language.get("profile.donation"))
    .css("margin-left", "7px")
    .attr("data-link", "https://giftseeker.ru/donation")
    .appendTo(info_links);
}

function renderUser(userData) {
  $(".content-item .info .avatar").css({
    "background-image": 'url("' + userData.avatar + '")'
  });
  $(".content-item .info .username").html(userData.username);
}

function openWebsite(url) {
  Browser.loadURL(url);
  Browser.setTitle("GS Browser - " + language.get("auth.browser_loading"));

  Browser.show();
}
