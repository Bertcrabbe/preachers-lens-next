// Compatibility shim — use `toast` from "sonner" directly in new code
import { toast } from "sonner";
export const useToast = () => ({ toast });
