import type { Translation } from "./types";

const zh: Translation = {
  site: {
    title: "XDeck 应用商店",
    tagline: "可通过 XDeck 部署的应用，支持 Docker Compose 项目或进程守护方式。",
  },
  common: {
    all: "全部",
    search: "搜索",
    copy: "复制",
    copied: "已复制",
    back: "全部应用",
    retry: "重试",
  },
  theme: { label: "主题", light: "浅色", dark: "深色", system: "跟随系统" },
  language: { label: "语言" },
  catalog: {
    search: "搜索应用",
    category: "分类",
    noMatch: "没有匹配的应用",
    empty: "该仓库暂无应用",
    error: "无法加载应用目录",
    count_one: "{{count}} 个应用",
    count_other: "{{count}} 个应用",
  },
  repo: {
    add: "添加到 XDeck",
    url: "仓库地址",
    hint: "XDeck → 应用商店 → 软件仓库",
  },
  categories: {
    database: "数据库",
    web: "Web",
    cache: "缓存",
    sql: "SQL",
    nosql: "NoSQL",
    proxy: "代理",
  },
  methods: { docker: "Docker", process: "进程守护" },
  platforms: { linux: "Linux", macos: "macOS", windows: "Windows" },
  app: {
    notFound: "未找到该应用",
    version: "版本",
    license: "许可证",
    homepage: "主页",
    methods: "部署方式",
    platforms: "平台",
    settings: "配置项",
    noSettings: "无配置项",
    files: "文件",
    setting: "配置项",
    default: "默认值",
    generated: "自动生成",
    required: "必填",
    installOnly: "仅安装时设置",
    onlyFor: "仅{{method}}",
    yes: "是",
    no: "否",
  },
  errors: { generic: "出现了一些问题", pageNotFound: "页面不存在" },
};

export default zh;
