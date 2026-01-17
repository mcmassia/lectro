export default function NotesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-bg-primary)]">
            {children}
        </div>
    );
}
