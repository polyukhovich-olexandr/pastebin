# Simple pastebin for course work

## Features

- Create new pastes (buckets)  
- Public and private buckets  
- Password-protected access (via bcrypt)  
- Expiration options (files are kept up to **7 days**)  
- Unique shareable URLs  
- Preview individual files directly in the browser  
- Download single files or the entire bucket as a **ZIP** or **TAR.GZ** archive (with maximum compression)  
- Each bucket can contain **up to 20 files**  
- Each file can be **up to 64 MB**  
- No passwords, no logins, no moderation  


## Tech Stack

- Backend: `Javascript`
- Frontend: `HTML`, `CSS`, `JavaScript`
- Database: `MySQL`

### **Build and run the app**

```bash
docker-compose up --build
```

🌐 Expose the app at http://localhost:8080

### **Stop the app**
```bash
docker-compose down
```

### **🐳 Quick Start with Docker**
```bash
git clone https://github.com/polyukhovich-olexandr/pastebin.git
cd pastebin
docker-compose up --build
```