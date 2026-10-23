<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LoanList from './components/LoanList.vue'

/** /write-offs: loans with status 3 or 6 (cba/write_offs.blade.php). The write-off form itself is reached from /loans. */
</script>

<template>
  <LoanList url="/write-offs" variant="writeoff">
    <template #breadcrumb>
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Write-offs
    </template>
  </LoanList>
</template>
