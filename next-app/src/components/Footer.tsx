const IG =
  "https://www.instagram.com/st.shmidt?mdxt=emx1MzR3dmN0MmZx&utm_source=qr";

export function Footer() {
  return (
    <footer className="footer">
      <a href={IG} target="_blank" rel="noopener noreferrer" aria-label="Instagram St. Shmidt">
        <img src="/brand/logo.png" alt="St. Shmidt" width={40} height={40} />
        <span className="muted">@st.shmidt</span>
      </a>
    </footer>
  );
}
