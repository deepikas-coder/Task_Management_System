import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import FirebaseConfigGuard from "../components/FirebaseConfigGuard";

export const metadata = {
  title: "Kibozera WorkSync - Employee Management System",
  description: "Real-time employee attendance, shift tracking, and task management built for modern teams.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <FirebaseConfigGuard>
            {children}
          </FirebaseConfigGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
