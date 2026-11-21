/** Course icon: an image link, an emoji, or 📘 when the admin saved neither. */
export default function CourseIcon({ icon, color, size = 64 }: { icon: string; color: string; size?: number }) {
  const value = (icon || "").trim();
  const isUrl = /^(https?:)?\/\//.test(value) || value.startsWith("/");
  const isEmoji = !isUrl && value.length > 0 && value.length <= 4;
  const tint = /^#|^rgb|^hsl|gradient\(/.test(color || "") ? color : "#FFFFFF";
  return (
    <div
      className="rounded-2xl flex items-center justify-center shadow-sm border-2 border-white overflow-hidden shrink-0"
      style={{ background: tint, width: size, height: size, fontSize: size * 0.5 }}
    >
      {isUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" style={{ width: size * 0.7, height: size * 0.7 }} className="object-contain" />
      ) : (
        <span>{isEmoji ? value : "📘"}</span>
      )}
    </div>
  );
}
