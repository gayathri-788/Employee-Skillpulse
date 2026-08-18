/** Shared Tailwind utility-class strings for patterns reused across many pages. */

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium cursor-pointer border border-transparent outline-none transition-[background-color,border-color,color,transform,box-shadow] duration-150 no-underline disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimary = `${btnBase} bg-accent-primary border-accent-primary text-[#0a0a0a] shadow-[var(--shadow-glow)] hover:bg-accent-primary-hover hover:border-accent-primary-hover hover:text-white hover:-translate-y-px hover:shadow-[0_6px_20px_0_var(--accent-glow-strong)]`;

export const btnSecondary = `${btnBase} bg-bg-tertiary border-border text-text-primary hover:bg-bg-input-focus hover:border-accent-primary`;

export const btnDanger = `${btnBase} bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5] hover:bg-danger hover:text-white`;

export const btnSuccess = `${btnBase} bg-accent-primary border-accent-primary text-white hover:bg-accent-primary-hover`;

export const btnIconOnly = "p-2.5 aspect-square";
export const btnBlock = "w-full";
export const btnSm = "!px-3 !py-1.5 !text-[0.85rem] gap-1.5";

export const btnClearIcon =
  "bg-transparent border-none text-text-secondary cursor-pointer p-1 inline-flex rounded-full hover:bg-black/5 hover:text-text-primary";

const badgeBase =
  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border";

export const badgeDefault = `${badgeBase} bg-bg-tertiary text-text-secondary border-border`;
export const badgeSuccess = `${badgeBase} bg-bg-success-glow text-success border-border-success`;
export const badgeWarning = `${badgeBase} bg-[rgba(245,158,11,0.15)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]`;
export const badgeDanger = `${badgeBase} bg-[rgba(239,68,68,0.15)] text-[#f87171] border-[rgba(239,68,68,0.3)]`;
export const badgeAdmin = badgeWarning;
export const badgeEmployee = `${badgeBase} bg-accent-glow text-[#34d399] border-[rgba(16,185,129,0.3)]`;

export const panelHeader = "flex items-center gap-3 px-6 py-5 border-b border-border [&_.material-icons-round]:text-accent-primary [&_.material-icons-round]:text-[1.4rem] [&_h2]:text-[1.15rem] [&_h2]:font-semibold";
export const panel = "bg-bg-card backdrop-blur-md border border-border rounded-lg shadow-md mb-[30px] overflow-hidden";
export const panelBody = "p-6";
export const panelHelperText = "text-[0.85rem] text-text-muted mb-5";

export const formLabel = "block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide";
export const formGroup = "mb-5";
export const gridTwo = "grid grid-cols-2 gap-5 max-md:grid-cols-1";
export const colSpan2 = "col-span-2 max-md:col-span-1";
export const inputDisabled = "!bg-bg-input-disabled !border-border !text-text-muted cursor-not-allowed";

export const pageHeaderRow = "flex items-center justify-between gap-5 mb-[30px] flex-wrap";
export const pageHeaderTitle = "text-[2rem] font-bold text-[color:var(--bg-page-blue-text)]";
export const pageHeaderSubtitle = "text-[0.95rem] text-[color:var(--bg-page-blue-text)] opacity-95";
export const pageHeaderBadges = "flex items-center gap-5 flex-wrap";
export const lastUpdatedBadge = "bg-bg-tertiary border border-border px-4 py-2 rounded-full text-[0.85rem] text-text-secondary [&_strong]:text-text-primary";

export const searchPanel = "bg-bg-card border border-border rounded-lg p-6 mb-[30px] shadow-sm";
export const searchGrid = "grid grid-cols-[repeat(3,1fr)_1.2fr] gap-5 items-end max-[992px]:grid-cols-2 max-[576px]:grid-cols-1";
export const adminSearchGrid = "grid grid-cols-[repeat(4,1fr)_1.2fr] gap-5 items-end max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1";
export const searchBtnGroup = "flex gap-3 [&>button]:flex-1 max-[992px]:col-span-2 max-[576px]:col-span-1";

export const topSkillsCell = "flex gap-1 flex-wrap max-w-[250px]";
export const tableRating = "inline-flex items-center gap-1 font-semibold text-text-primary [&_span]:text-warning [&_span]:text-base";

export const empCard =
  "bg-bg-card border border-border rounded-lg p-6 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 hover:border-accent-secondary hover:shadow-md hover:bg-bg-tertiary";
const skillTagBase = "text-xs px-2 py-0.5 rounded-sm border";
export const skillTag = `${skillTagBase} bg-bg-secondary border-border text-text-secondary`;
export const skillTagPrimary = `${skillTagBase} border-[rgba(16,185,129,0.2)] bg-accent-glow text-accent-primary`;

export const statsRow = "grid grid-cols-3 gap-5 mb-[30px] max-[992px]:grid-cols-2 max-[576px]:grid-cols-1";
export const statCard = "bg-bg-card border border-border rounded-lg p-6 flex items-center gap-4";
export const statIconWrapper = "w-[52px] h-[52px] rounded-md flex items-center justify-center [&>span]:text-[1.8rem]";
export const statIconPurple = "bg-[rgba(139,92,246,0.12)] text-[#a78bfa]";
export const statIconGreen = "bg-bg-success-glow text-success";
export const statIconOrange = "bg-[rgba(245,158,11,0.12)] text-[#fbbf24]";
export const statIconAmber = "bg-[rgba(245,158,11,0.12)] text-accent-secondary";
export const statIconBlue = "bg-[rgba(14,165,233,0.12)] text-[#38bdf8]";
export const statIconRed = "bg-[rgba(239,68,68,0.12)] text-[#f87171]";
export const statInfo = "flex flex-col";
export const statLabel = "text-[0.85rem] dark:text-white/80 text-black font-medium";
export const statNumber = "font-[Outfit,Inter,sans-serif] text-[1.4rem] font-bold";

export const scheduleMetaItem =
  "flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-border rounded-md text-[0.85rem] [&_.material-icons-round]:text-[1.1rem] [&_.material-icons-round]:text-accent-secondary [&_strong]:text-text-primary";

export const shiftDropdown =
  "w-full !py-2.5 !px-3 bg-bg-input border border-border rounded-sm text-text-primary text-[0.88rem] cursor-pointer transition-colors duration-150 focus:!shadow-[0_0_0_3px_rgba(16,185,129,0.15)]";

export const totalExpBadge =
  "inline-flex items-center gap-2.5 px-[18px] py-3.5 bg-gradient-to-br from-[rgba(99,102,241,0.12)] to-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.25)] rounded-md text-text-primary font-medium text-sm [&_.material-icons-round]:text-accent-secondary [&_.material-icons-round]:text-[1.4rem]";

export const adminTable =
  "w-full border-collapse text-left text-[0.875rem] [&_th]:px-5 [&_th]:py-4 [&_td]:px-5 [&_td]:py-4 [&_th]:border-b [&_td]:border-b [&_th]:border-border [&_td]:border-border [&_th]:bg-bg-tertiary [&_th]:font-semibold [&_th]:text-text-secondary [&_th]:uppercase [&_th]:text-xs [&_th]:tracking-wide [&_td]:text-text-secondary [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-bg-tertiary [&_tr>td:nth-child(2)]:text-text-primary [&_tr>td:nth-child(2)]:font-medium";

const alertBase = "flex items-center gap-2 px-4 py-3 rounded-md text-sm border [&_.material-icons-round]:align-middle";
export const alertSuccess = `${alertBase} bg-bg-success-glow text-success border-border-success`;
export const alertWarning = `${alertBase} bg-[rgba(245,158,11,0.1)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]`;
export const alertDanger = `${alertBase} bg-[rgba(239,68,68,0.1)] text-[#f87171] border-[rgba(239,68,68,0.3)]`;

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
