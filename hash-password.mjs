import { hashPassword } from "better-auth/crypto";

async function generateNewHash() {
  // เปลี่ยนรหัสผ่านใหม่ที่คุณต้องการตรงนี้
  const newPassword = "กรอก pass ที่่ต้องการ";
  
  const hashedPassword = await hashPassword(newPassword);
  
  console.log("----------------------------------------");
  console.log("Password ที่แฮชแล้วสำหรับนำไปใช้ใน SQL:");
  console.log(hashedPassword);
  console.log("----------------------------------------");
}

generateNewHash();