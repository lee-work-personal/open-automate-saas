'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/constants';

export interface ProjectVariable {
    id: string;
    organizationId: string;
    projectId: string;
    key: string;
    value: string;
    isSecret: boolean;
    description?: string;
    createdAt?: any;
    updatedAt?: any;
}

export function useProjectVariables(projectId: string) {
    const [variables, setVariables] = useState<ProjectVariable[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        const q = query(
            collection(db, COLLECTIONS.VARIABLES),
            where('projectId', '==', projectId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const vars = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ProjectVariable)).sort((a, b) => a.key.localeCompare(b.key));
            setVariables(vars);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching variables:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [projectId]);

    return { variables, loading };
}

export function useProjectVariableMutations() {
    const [loading, setLoading] = useState(false);

    const createVariable = async (data: Omit<ProjectVariable, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
        setLoading(true);
        try {
            const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, data.projectId));
            const organizationId = projectSnap.data()?.organizationId;
            if (!organizationId) {
                throw new Error('Project organization could not be resolved');
            }

            await addDoc(collection(db, COLLECTIONS.VARIABLES), {
                ...data,
                organizationId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        } finally {
            setLoading(false);
        }
    };

    const updateVariable = async (id: string, data: Partial<ProjectVariable>) => {
        setLoading(true);
        try {
            await updateDoc(doc(db, COLLECTIONS.VARIABLES, id), {
                ...data,
                updatedAt: Timestamp.now()
            });
        } finally {
            setLoading(false);
        }
    };

    const deleteVariable = async (id: string) => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, COLLECTIONS.VARIABLES, id));
        } finally {
            setLoading(false);
        }
    };

    return { createVariable, updateVariable, deleteVariable, loading };
}
