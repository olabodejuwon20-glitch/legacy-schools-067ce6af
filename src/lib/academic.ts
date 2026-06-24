import { supabase } from "@/integrations/supabase/client";

export type AcademicTemplate = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  description: string | null;
  is_active: boolean;
  body: any;
};

export type Level   = { id: string; school_id: string; code: string; name: string; sort_order: number; status: string };
export type AClass  = {
  id: string; school_id: string; level_id: string;
  code: string; name: string; category: string | null;
  capacity: number | null; description: string | null; status: string; sort_order: number;
  promotion_target_class_id: string | null;
};
export type Department = { id: string; school_id: string; code: string; name: string; description: string | null; status: string };
export type Arm = {
  id: string; school_id: string; class_id: string;
  department_id: string | null; name: string; code: string;
  capacity: number | null; class_teacher_user_id: string | null; status: string;
};
export type Subject = {
  id: string; school_id: string; code: string; name: string;
  department_id: string | null; category: string; description: string | null; status: string;
};
export type SubjectArm = { id: string; subject_id: string; arm_id: string; is_required: boolean };

export async function listTemplates() {
  const { data, error } = await supabase
    .from("academic_templates")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data || []) as AcademicTemplate[];
}

export async function getSchoolStructure(school_id: string) {
  const { data } = await supabase
    .from("school_academic_structure")
    .select("*")
    .eq("school_id", school_id)
    .maybeSingle();
  return data as { school_id: string; template_code: string; activated_at: string; settings: any } | null;
}

export async function applyTemplate(school_id: string, template_code: string) {
  const { data, error } = await supabase.rpc("apply_academic_template", {
    _school_id: school_id, _template_code: template_code,
  });
  if (error) throw error;
  return data;
}

export async function promoteArm(arm_id: string, to_arm_id: string) {
  const { data, error } = await supabase.rpc("promote_arm", {
    _arm_id: arm_id, _to_arm_id: to_arm_id,
  });
  if (error) throw error;
  return data;
}